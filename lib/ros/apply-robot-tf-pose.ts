import * as THREE from 'three'
import { applyWorldPose } from '@/lib/ros/apply-world-pose'
import { rosTransformToThreeWorld } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'

/** 底盘在 TF 树中的候选（与 GLB 根节点对应，优先 base_link 而非其子 chassis） */
export const ROBOT_BASE_TF_FRAMES = [
  'base_link',
  'base_footprint',
  'chassis_link',
  'chassis',
  'ego',
] as const

const _pos = new THREE.Vector3()
const _quat = new THREE.Quaternion()

export function resolveRobotTfFrame(): string | null {
  const ids = tfRuntimeStore.getFrameIds()
  for (const frame of ROBOT_BASE_TF_FRAMES) {
    if (ids.includes(frame)) return frame
  }
  return null
}

/**
 * 在 display/fixed frame 下取机器人根位姿（与 TF 轴 lookup 同一条边）。
 * odom → base_link 与其它 child 一样走 lookupTransform，没有单独公式。
 */
export function lookupRobotPoseInFixedFrame(fixedFrame: string): RosTransform | null {
  const robotFrame = resolveRobotTfFrame()
  if (!robotFrame) return null
  if (fixedFrame === robotFrame) {
    return {
      translation: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    }
  }
  return tfRuntimeStore.lookupTransform(fixedFrame, robotFrame)
}

/** 把 GLB 根节点放到与 TF 轴重合的世界位姿上 */
export function applyRobotPoseFromTf(
  obj: THREE.Object3D,
  fixedFrame: string,
): boolean {
  const T = lookupRobotPoseInFixedFrame(fixedFrame)
  if (!T) return false
  rosTransformToThreeWorld(T.translation, T.rotation, _pos, _quat)
  applyWorldPose(obj, _pos, _quat)
  obj.updateMatrixWorld(true)
  return true
}
