import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

/**
 * Playback keeps the active cloud in its native sensor frame at the origin
 * (followRobot=false). Annotations must use the same frame or they skew
 * (NuScenes LIDAR_TOP is ~90° yaw + 1.84m above base_link).
 */
export function getPlaybackCloudFrameId(): string {
  return lidarPointStore.frameId || 'LIDAR_TOP'
}

/**
 * ROS Z height of lidar above base_link → Three.js +Y lift so ground ≈ grid.
 * Only when the lidar edge is parented to base_link / ego.
 */
export function getPlaybackGroundLiftY(): number {
  const frame = getPlaybackCloudFrameId()
  const edge = tfRuntimeStore.getEdge(frame)
  if (!edge) return 0
  const parent = edge.parentFrame
  if (parent !== 'base_link' && parent !== 'ego' && parent !== 'chassis_link') return 0
  const z = edge.transform.translation.z
  return Number.isFinite(z) ? z : 0
}
