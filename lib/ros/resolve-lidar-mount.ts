import * as THREE from 'three'

/** glTF 中 Nova Carter 雷达挂载节点（静态外参已烘焙在层级里） */
const LIDAR_MOUNT_NAME_PATTERNS = [
  /^front_RPLidar$/i,
  /^front_RPLidar_link$/i,
  /^front_3d_lidar$/i,
  /^front_3d_lidar_link$/i,
  /RPLidar/i,
]

export function isLidarMountName(name: string): boolean {
  return LIDAR_MOUNT_NAME_PATTERNS.some((p) => p.test(name))
}

export function findLidarMountNode(root: THREE.Object3D): THREE.Object3D | null {
  if (isLidarMountName(root.name)) return root

  let found: THREE.Object3D | null = null
  root.traverse((child) => {
    if (found || !child.name) return
    if (isLidarMountName(child.name)) found = child
  })
  return found
}
