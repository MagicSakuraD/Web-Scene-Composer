import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import { getDefaultStore } from 'jotai'
import { tfDisplayAtom } from '@/lib/ros/atoms'
import { dataSourceModeAtom } from '@/lib/playback/atoms'

/**
 * Playback keeps the active cloud in its native sensor frame at the origin
 * (followRobot=false). Annotations must use the same frame or they skew
 * (NuScenes LIDAR_TOP is ~90° yaw + 1.84m above base_link).
 */
export function getPlaybackCloudFrameId(): string {
  return lidarPointStore.frameId || 'LIDAR_TOP'
}

/**
 * Fixed / display frame：静止世界系（Foxglove 3D 的 fixed_frame）。
 * Live：优先 map / odom，地图与代价地图不动，小车在其上走；
 * 视角跟随由 FollowEgoCamera 完成，不要把 Fixed Frame 设成 base_link。
 * 回放：点云传感器系（勿误用 LIDAR_TOP 导致 optical TF 失败）。
 */
export function resolveSceneFixedFrame(opts: {
  configured?: string
  dataSourceMode: string
  lidarFrameId?: string
}): string {
  const trimmed = opts.configured?.trim()
  if (trimmed) return trimmed
  if (opts.dataSourceMode === 'replay') {
    return opts.lidarFrameId || getPlaybackCloudFrameId()
  }
  const frames = tfRuntimeStore.getFrameIds()
  if (frames.includes('map')) return 'map'
  if (frames.includes('odom')) return 'odom'
  if (frames.includes('ego')) return 'ego'
  if (frames.includes('base_link')) return 'base_link'
  return frames[0] ?? 'map'
}

/** 当前面板 Fixed Frame（与 TF 轴 / 视锥同一来源） */
export function getSceneFixedFrameNow(): string {
  const store = getDefaultStore()
  return resolveSceneFixedFrame({
    configured: store.get(tfDisplayAtom).fixedFrame,
    dataSourceMode: store.get(dataSourceModeAtom),
    lidarFrameId: lidarPointStore.frameId,
  })
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

/** Live 仿真不需要点云抬升；回放才抬 */
export function getSceneGroundLiftY(dataSourceMode: string): number {
  return dataSourceMode === 'replay' ? getPlaybackGroundLiftY() : 0
}
