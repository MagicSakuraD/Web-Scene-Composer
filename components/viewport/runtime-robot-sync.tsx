'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { applyWorldPose } from '@/lib/ros/apply-world-pose'
import {
  areCasterWheelsBound,
  bindCasterWheelsToSwivels,
  computeChassisTravelDirectionWorld,
  isCasterSwivelName,
  resetCasterSwivelStates,
  resolveRobotAnimRoot,
  updateCasterSwivel,
} from '@/lib/ros/caster-swivel'
import {
  applyWheelSpin,
  isCasterWheelName,
  isDriveWheelName,
  resetWheelSpinStates,
  WHEEL_RADIUS,
} from '@/lib/ros/wheel-spin'

/** 144Hz 下 odom 帧间位移极小，阈值不能太高 */
const CHASSIS_MOVE_THRESHOLD = 0.0001

const _chassisPos = new THREE.Vector3()
const _prevChassisPos = new THREE.Vector3()
const _chassisDelta = new THREE.Vector3()
const _travelDir = new THREE.Vector3()
const _chassisForward = new THREE.Vector3()

function collectAnimNodes(searchRoot: THREE.Object3D) {
  const driveWheels: THREE.Object3D[] = []
  const casterWheels: THREE.Object3D[] = []
  const swivels: THREE.Object3D[] = []

  searchRoot.traverse((child) => {
    const name = child.name
    if (!name) return
    if (isCasterSwivelName(name)) {
      swivels.push(child)
      return
    }
    if (isCasterWheelName(name)) {
      casterWheels.push(child)
      return
    }
    if (isDriveWheelName(name)) {
      driveWheels.push(child)
    }
  })

  return { driveWheels, casterWheels, swivels }
}

/**
 * 每帧同步：
 * - 底盘位姿 ← ROS /chassis/odom
 * - 万向轮支架 ← 位移方向（局部 Y）；caster_wheel 为子节点随动
 * - 四轮滚动 ← 底盘真实位移差分（主）；twist.linear.x 仅作回退
 */
export function RuntimeRobotSync() {
  const status = useAtomValue(simulateStatusAtom)
  const driveWheelRefs = useRef<THREE.Object3D[]>([])
  const casterWheelRefs = useRef<THREE.Object3D[]>([])
  const swivelRefs = useRef<THREE.Object3D[]>([])
  const boundTargetRef = useRef<string | null>(null)
  const nodesDiscoveredRef = useRef(false)
  const chassisTrackReadyRef = useRef(false)

  useFrame((_, delta) => {
    if (status !== 'connected' || !runtimePoseStore.active || !runtimePoseStore.robotNodeId) {
      return
    }

    const targetId = runtimePoseStore.robotNodeId
    const obj = objectByNodeId.get(targetId)
    if (!obj) return

    if (boundTargetRef.current !== targetId) {
      driveWheelRefs.current = []
      casterWheelRefs.current = []
      swivelRefs.current = []
      boundTargetRef.current = targetId
      nodesDiscoveredRef.current = false
      chassisTrackReadyRef.current = false
    }

    applyWorldPose(obj, runtimePoseStore.position, runtimePoseStore.quaternion)
    obj.updateMatrixWorld(true)

    const animRoot = resolveRobotAnimRoot(obj)
    const needsDiscovery =
      !nodesDiscoveredRef.current ||
      swivelRefs.current.length === 0 ||
      !areCasterWheelsBound(swivelRefs.current)

    if (needsDiscovery) {
      const { driveWheels, casterWheels, swivels } = collectAnimNodes(animRoot)
      driveWheelRefs.current = driveWheels
      swivelRefs.current = swivels

      const attachedWheels = bindCasterWheelsToSwivels(swivels, casterWheels)
      casterWheelRefs.current = attachedWheels.length > 0 ? attachedWheels : casterWheels

      animRoot.updateMatrixWorld(true)

      if (swivels.length > 0 && areCasterWheelsBound(swivels)) {
        nodesDiscoveredRef.current = true
      }

      if (process.env.NODE_ENV === 'development' && swivels.length > 0) {
        console.info('[RuntimeRobotSync]', {
          animRoot: animRoot.name,
          driveWheels: driveWheels.map((w) => w.name),
          casterWheels: casterWheelRefs.current.map(
            (w) => `${w.name} → ${w.parent?.name ?? '?'}`,
          ),
          swivels: swivels.map((s) => s.name),
        })
      }
    }

    obj.getWorldPosition(_chassisPos)

    let hasChassisDelta = false
    let signedDistance = 0

    if (!chassisTrackReadyRef.current) {
      _prevChassisPos.copy(_chassisPos)
      chassisTrackReadyRef.current = true
    } else {
      _chassisDelta.subVectors(_chassisPos, _prevChassisPos)
      _prevChassisPos.copy(_chassisPos)
      hasChassisDelta = _chassisDelta.lengthSq() > 1e-10

      if (
        computeChassisTravelDirectionWorld(
          obj,
          _chassisDelta,
          runtimePoseStore.linearX,
          runtimePoseStore.angularZ,
          CHASSIS_MOVE_THRESHOLD,
          _travelDir,
        )
      ) {
        for (const swivel of swivelRefs.current) {
          updateCasterSwivel(swivel, obj, _travelDir, delta)
        }
      }

      if (hasChassisDelta) {
        // Nova Carter / ROS：局部 +X 为车头方向
        _chassisForward.set(1, 0, 0).applyQuaternion(obj.quaternion)
        _chassisForward.y = 0
        if (_chassisForward.lengthSq() > 1e-10) {
          _chassisForward.normalize()
          signedDistance = _chassisDelta.dot(_chassisForward)
        }
      }
    }

    let spin = 0
    if (hasChassisDelta && Math.abs(signedDistance) > 1e-8) {
      // 位移已是本帧增量，直接除以半径得转角（弧度）
      spin = signedDistance / WHEEL_RADIUS
    } else if (Math.abs(runtimePoseStore.linearX) > 0.005) {
      spin = (runtimePoseStore.linearX / WHEEL_RADIUS) * delta
    }

    for (const wheel of driveWheelRefs.current) {
      applyWheelSpin(wheel, spin)
    }
    for (const wheel of casterWheelRefs.current) {
      applyWheelSpin(wheel, spin)
    }
  })

  return null
}

export function clearRuntimeAnimCache(targetId: string | null) {
  if (!targetId) return
  const obj = objectByNodeId.get(targetId)
  if (!obj) return
  resetWheelSpinStates(obj)
  resetCasterSwivelStates(obj)
}
