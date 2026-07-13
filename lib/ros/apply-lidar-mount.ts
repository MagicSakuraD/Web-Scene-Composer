import * as THREE from 'three'
import { findObjectByTfFrame } from '@/lib/ros/apply-tf-joints'
import { rosPositionToThree, rosRelativeQuaternionToThree } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import {
  findExactFrameNode,
  findLidarMountNode,
} from '@/lib/ros/resolve-lidar-mount'

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

/**
 * PointCloud2.header.frame_id（front_3d_lidar）即点坐标所在系。
 * 优先挂 glTF 传感器 prim（Nova Carter：XT_32），其局部原点已与场景对齐；
 * 无传感器节点时再用 /tf（base_link → front_3d_lidar）挂到 chassis_link。
 */
export function applyLidarCloudMount(
  cloudGroup: THREE.Object3D,
  animRoot: THREE.Object3D,
  frameId: string,
  topic: string,
): 'frame' | 'tf' | 'gltf' | null {
  const frame = normalizeFrameId(frameId) || 'front_3d_lidar'

  if (applyLidarCloudMountExactFrame(cloudGroup, animRoot, frame)) return 'frame'
  if (applyLidarCloudMountFromTf(cloudGroup, animRoot, frame)) return 'tf'
  if (applyLidarCloudMountFromGltf(cloudGroup, animRoot, topic, frame)) return 'gltf'
  return null
}

/** 挂到传感器 prim（如 XT_32）：点已在该光学系，本地位姿为单位变换 */
export function applyLidarCloudMountExactFrame(
  cloudGroup: THREE.Object3D,
  animRoot: THREE.Object3D,
  frameId: string,
): boolean {
  const mount = findExactFrameNode(animRoot, frameId)
  if (!mount) return false

  if (cloudGroup.parent !== mount) {
    mount.attach(cloudGroup)
  }
  cloudGroup.position.set(0, 0, 0)
  cloudGroup.quaternion.identity()
  return true
}

/**
 * 用 /tf 将点云挂到父 link（glTF 多为 chassis_link）下。
 * 绝对外参不做 ODOM_DELTA_FLIP_XZ：该翻转只适用于底盘世界增量，不适用于 link 局部外参。
 */
export function applyLidarCloudMountFromTf(
  cloudGroup: THREE.Object3D,
  animRoot: THREE.Object3D,
  frameId: string,
): boolean {
  const childFrame = normalizeFrameId(frameId)
  if (!childFrame) return false

  const edge = tfRuntimeStore.getEdge(childFrame)
  if (!edge) return false

  let parent = findObjectByTfFrame(animRoot, edge.parentFrame)
  if (!parent) parent = findObjectByTfFrame(animRoot, 'chassis_link')
  if (!parent) parent = animRoot

  if (cloudGroup.parent !== parent) {
    parent.attach(cloudGroup)
  }

  const t = edge.transform.translation
  const r = edge.transform.rotation
  rosPositionToThree(t.x, t.y, t.z, cloudGroup.position)
  rosRelativeQuaternionToThree(r.x, r.y, r.z, r.w, cloudGroup.quaternion)
  return true
}

/** glTF 静态雷达回退 */
export function applyLidarCloudMountFromGltf(
  cloudGroup: THREE.Object3D,
  animRoot: THREE.Object3D,
  topic: string,
  preferredFrameId?: string,
): boolean {
  const mount = findLidarMountNode(animRoot, topic, preferredFrameId)
  if (!mount) return false

  if (cloudGroup.parent !== mount) {
    mount.attach(cloudGroup)
  }
  cloudGroup.position.set(0, 0, 0)
  cloudGroup.quaternion.identity()
  return true
}
