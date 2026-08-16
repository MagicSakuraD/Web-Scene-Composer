'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import { applyWheelJointsFromTf, resetTfJointCalibration } from '@/lib/ros/apply-tf-joints'
import { applyRobotPoseFromTf } from '@/lib/ros/apply-robot-tf-pose'
import { applyWorldPose } from '@/lib/ros/apply-world-pose'
import { tfDisplayAtom } from '@/lib/ros/atoms'
import { odomSceneCalibration } from '@/lib/ros/odom-scene-calibration'
import { resolveSceneFixedFrame } from '@/lib/ros/playback-display-frame'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { resolveRobotAnimRoot } from '@/lib/ros/caster-swivel'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import {
  applyWheelSpinFromOdom,
  collectWheelSpinTargets,
  resetWheelSpinStates,
  type WheelSpinTargets,
} from '@/lib/ros/wheel-spin'

/**
 * 每帧同步：
 * - 底盘位姿 ← /tf（fixed frame → base_link），与 TF 轴同一套 lookup
 * - 无 TF 时回退绝对 odom（不再用相对场景起点的方案 B）
 * - 万向轮支架转向 ← /tf
 * - 四轮滚动 ← odom twist Dead Reckoning
 */
export function RuntimeRobotSync() {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const tfConfig = useAtomValue(tfDisplayAtom)
  const boundTargetRef = useRef<string | null>(null)
  const poseLoggedRef = useRef(false)
  const tfLoggedRef = useRef(false)
  const wheelTargetsRef = useRef<WheelSpinTargets | null>(null)

  useFrame((_, delta) => {
    if (!dataSourceActive || !runtimePoseStore.active || !runtimePoseStore.robotNodeId) {
      return
    }

    const targetId = runtimePoseStore.robotNodeId
    const obj = objectByNodeId.get(targetId)
    if (!obj) return

    if (boundTargetRef.current !== targetId) {
      boundTargetRef.current = targetId
      poseLoggedRef.current = false
      tfLoggedRef.current = false
      wheelTargetsRef.current = null
      odomSceneCalibration.reset()
      const animRoot = resolveRobotAnimRoot(obj)
      resetTfJointCalibration(animRoot)
      resetWheelSpinStates(animRoot)
    }

    const fixedFrame = resolveSceneFixedFrame({
      configured: tfConfig.fixedFrame,
      dataSourceMode,
      lidarFrameId: lidarPointStore.frameId,
    })

    const fromTf = tfRuntimeStore.active && applyRobotPoseFromTf(obj, fixedFrame)
    if (!fromTf) {
      if (!runtimePoseStore.hasOdom) return
      applyWorldPose(obj, runtimePoseStore.position, runtimePoseStore.quaternion)
      obj.updateMatrixWorld(true)
    }

    if (process.env.NODE_ENV === 'development' && !poseLoggedRef.current) {
      poseLoggedRef.current = true
      console.info('[RuntimeRobotSync] 底盘已绑定', {
        source: fromTf ? `tf ${fixedFrame}→base` : 'odom absolute',
        node: obj.name,
        fixedFrame,
      })
    }

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
