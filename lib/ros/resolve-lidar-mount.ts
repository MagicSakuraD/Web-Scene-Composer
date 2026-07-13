import * as THREE from 'three'

/**
 * ROS frame_id / 话题 → glTF 节点名（Isaac Nova Carter 导出常为传感器型号名，非 ROS frame 名）
 * 例：front_3d_lidar 点云 ↔ chassis_link/sensors/XT_32
 */
export const LIDAR_FRAME_TO_GLTF_NAMES: Record<string, readonly string[]> = {
  front_3d_lidar: ['front_3d_lidar', 'XT_32', 'front_3d_lidar_link'],
  front_3d_lidar_link: ['front_3d_lidar_link', 'XT_32', 'front_3d_lidar'],
  front_RPLidar: ['front_RPLidar', 'front_RPLidar_link'],
  front_RPLidar_link: ['front_RPLidar_link', 'front_RPLidar'],
  front_2d_lidar: ['front_RPLidar', 'front_2d_lidar'],
}

/** glTF 中 Nova Carter 雷达挂载节点 */
const LIDAR_MOUNT_NAME_PATTERNS = [
  /^XT_32$/i,
  /^front_3d_lidar$/i,
  /^front_3d_lidar_link$/i,
  /^front_RPLidar$/i,
  /^front_RPLidar_link$/i,
  /RPLidar/i,
]

export function isLidarMountName(name: string): boolean {
  return LIDAR_MOUNT_NAME_PATTERNS.some((p) => p.test(name))
}

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

function findNodeByExactName(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const needle = name.toLowerCase()
  if (!needle) return null
  if (root.name && root.name.toLowerCase() === needle) return root
  let found: THREE.Object3D | null = null
  root.traverse((obj) => {
    if (found || obj === root || !obj.name) return
    if (obj.name.toLowerCase() === needle) found = obj
  })
  return found
}

/**
 * 按 ROS frame_id 找 glTF 传感器节点（含 XT_32 等别名）。
 */
export function findExactFrameNode(
  root: THREE.Object3D,
  frameId: string,
): THREE.Object3D | null {
  const key = normalizeFrameId(frameId)
  if (!key) return null
  const names = LIDAR_FRAME_TO_GLTF_NAMES[key] ?? [key]
  for (const name of names) {
    const hit = findNodeByExactName(root, name)
    if (hit) return hit
  }
  return null
}

function collectLidarMounts(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  root.traverse((child) => {
    if (child.name && isLidarMountName(child.name)) out.push(child)
  })
  return out
}

/**
 * 按话题 / frame_id 匹配雷达节点。
 * 3D：XT_32 / front_3d_lidar；2D：front_RPLidar。
 */
export function findLidarMountNode(
  root: THREE.Object3D,
  topic?: string,
  preferredFrameId?: string,
): THREE.Object3D | null {
  if (preferredFrameId) {
    const mapped = findExactFrameNode(root, preferredFrameId)
    if (mapped) return mapped
  }

  const candidates = collectLidarMounts(root)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const is3dTopic =
    topic?.includes('3d_lidar') ||
    preferredFrameId?.includes('3d_lidar') ||
    preferredFrameId === 'XT_32'

  if (is3dTopic) {
    const xt = candidates.find((c) => /^XT_32$/i.test(c.name))
    if (xt) return xt
    const optical = candidates.find(
      (c) => /3d_lidar/i.test(c.name) && !/_link$/i.test(c.name),
    )
    if (optical) return optical
  }

  if (topic && /RPLidar|2d_lidar/i.test(topic)) {
    const optical = candidates.find(
      (c) => /RPLidar/i.test(c.name) && !/_link$/i.test(c.name) && !/rear/i.test(c.name),
    )
    if (optical) return optical
  }

  return (
    candidates.find((c) => /^XT_32$/i.test(c.name)) ??
    candidates.find((c) => /3d_lidar/i.test(c.name) && !/_link$/i.test(c.name)) ??
    candidates[0]
  )
}
