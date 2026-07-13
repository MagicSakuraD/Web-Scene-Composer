import * as THREE from 'three'
import { rosPositionToThree } from '@/lib/ros/ros-three-coords'
import { odomSceneCalibration } from '@/lib/ros/odom-scene-calibration'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { NAV_MAP_FRAME } from '@/lib/ros/nav-goal-config'

const _scratch = new THREE.Vector3()
const _robotPos = new THREE.Vector3()
const _robotQuat = new THREE.Quaternion()

export function normalizeRosFrameId(frameId: string): string {
  const id = frameId.trim()
  if (!id) return NAV_MAP_FRAME
  return id.startsWith('/') ? id.slice(1) : id
}

/**
 * 将 Path 中的位姿点变换到 Three.js 场景坐标。
 *
 * - map：全局规划，与 GLB 场景同系（/plan 正确的原因）
 * - odom：局部规划常用系；需与小车相同的 odom→场景校准，不是相对小车 body 的增量
 * - base_link：相对车体；需叠在小车当前显示位姿上
 */
export function rosPathPointToSceneThree(
  rosX: number,
  rosY: number,
  rosZ: number,
  frameId: string,
  out = _scratch,
): THREE.Vector3 {
  const frame = normalizeRosFrameId(frameId)

  if (frame === NAV_MAP_FRAME) {
    return rosPositionToThree(rosX, rosY, rosZ, out)
  }

  if (frame === 'odom') {
    return odomSceneCalibration.odomRosPointToSceneThree(rosX, rosY, rosZ, out)
  }

  if (frame === 'base_link' || frame === 'base_footprint') {
    if (!runtimePoseStore.hasOdom || !odomSceneCalibration.isReady()) {
      return rosPositionToThree(rosX, rosY, rosZ, out)
    }
    const { pos, quat } = odomSceneCalibration.computeDisplayPose(
      runtimePoseStore.position,
      runtimePoseStore.quaternion,
      _robotPos,
      _robotQuat,
    )
    rosPositionToThree(rosX, rosY, rosZ, out)
    out.applyQuaternion(quat)
    out.add(pos)
    return out
  }

  // 未知坐标系：先按 map 处理，避免完全不可见
  return rosPositionToThree(rosX, rosY, rosZ, out)
}

export function fillScenePathPositions(
  rosPositions: Float32Array,
  poseCount: number,
  frameId: string,
  out: Float32Array,
): void {
  for (let i = 0; i < poseCount; i++) {
    const o = i * 3
    const v = rosPathPointToSceneThree(
      rosPositions[o],
      rosPositions[o + 1],
      rosPositions[o + 2],
      frameId,
    )
    out[o] = v.x
    out[o + 1] = v.y
    out[o + 2] = v.z
  }
}
