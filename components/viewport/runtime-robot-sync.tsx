'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { applyWheelJointsFromTf, resetTfJointCalibration } from '@/lib/ros/apply-tf-joints'
import { odomSceneCalibration } from '@/lib/ros/odom-scene-calibration'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { applyWorldPose } from '@/lib/ros/apply-world-pose'
import { resolveRobotAnimRoot } from '@/lib/ros/caster-swivel'
import {
  applyWheelSpinFromOdom,
  collectWheelSpinTargets,
  resetWheelSpinStates,
  type WheelSpinTargets,
} from '@/lib/ros/wheel-spin'

const _displayPos = new THREE.Vector3()
const _displayQuat = new THREE.Quaternion()

/**
 * 每帧同步：
 * - 底盘位姿 ← ROS /chassis/odom（相对 GLB 静态起点做增量，方案 B）
 * - 万向轮支架转向 ← ROS /tf（caster_swivel_*）
 * - 四轮滚动 ← odom twist 本地 Dead Reckoning（高频、顺滑）
 */
export function RuntimeRobotSync() {
  const status = useAtomValue(simulateStatusAtom)
  const boundTargetRef = useRef<string | null>(null)
  const tfLoggedRef = useRef(false)
  const calibLoggedRef = useRef(false)
  const wheelTargetsRef = useRef<WheelSpinTargets | null>(null)

  useFrame((_, delta) => {
    if (status !== 'connected' || !runtimePoseStore.active || !runtimePoseStore.robotNodeId) {
      return
    }

    const targetId = runtimePoseStore.robotNodeId
    const obj = objectByNodeId.get(targetId)
    if (!obj) return

    if (boundTargetRef.current !== targetId) {
      boundTargetRef.current = targetId
      tfLoggedRef.current = false
      calibLoggedRef.current = false
      wheelTargetsRef.current = null
      odomSceneCalibration.reset()
      const animRoot = resolveRobotAnimRoot(obj)
      resetTfJointCalibration(animRoot)
      resetWheelSpinStates(animRoot)
    }

    odomSceneCalibration.captureSceneOrigin(obj)

    if (!runtimePoseStore.hasOdom) return

    odomSceneCalibration.captureOdomOrigin(
      runtimePoseStore.position,
      runtimePoseStore.quaternion,
    )

    if (!odomSceneCalibration.isReady()) return

    if (process.env.NODE_ENV === 'development' && !calibLoggedRef.current) {
      calibLoggedRef.current = true
      console.info('[RuntimeRobotSync] odom 已对齐 GLB 静态起点（方案 B）')
    }

    const { pos, quat } = odomSceneCalibration.computeDisplayPose(
      runtimePoseStore.position,
      runtimePoseStore.quaternion,
      _displayPos,
      _displayQuat,
    )
    applyWorldPose(obj, pos, quat)
    obj.updateMatrixWorld(true)

    const animRoot = resolveRobotAnimRoot(obj)

    if (!wheelTargetsRef.current) {
      wheelTargetsRef.current = collectWheelSpinTargets(animRoot)
      if (process.env.NODE_ENV === 'development') {
        const t = wheelTargetsRef.current
        console.info('[RuntimeRobotSync] 轮子滚动目标', {
          drive: [t.driveLeft?.name, t.driveRight?.name],
          caster: [t.casterLeft?.name, t.casterRight?.name],
        })
      }
    }

    if (tfRuntimeStore.active) {
      const applied = applyWheelJointsFromTf(animRoot)
      if (applied && process.env.NODE_ENV === 'development' && !tfLoggedRef.current) {
        tfLoggedRef.current = true
        console.info('[RuntimeRobotSync] 万向轮支架由 /tf 驱动', { animRoot: animRoot.name })
      }
    }

    applyWheelSpinFromOdom(
      wheelTargetsRef.current,
      runtimePoseStore.linearX,
      runtimePoseStore.angularZ,
      delta,
    )
  })

  return null
}

export function clearRuntimeAnimCache(targetId: string | null) {
  odomSceneCalibration.reset()
  tfRuntimeStore.reset()
  if (targetId) {
    const obj = objectByNodeId.get(targetId)
    if (obj) {
      const animRoot = resolveRobotAnimRoot(obj)
      resetTfJointCalibration(animRoot)
      resetWheelSpinStates(animRoot)
    }
  }
}
