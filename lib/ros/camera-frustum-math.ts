import type { DecodedCameraInfo } from '@/lib/ros/camera-info-store'

export interface FrustumCornersRos {
  /** Camera optical origin */
  origin: [number, number, number]
  /** Image plane corners TL, TR, BR, BL in camera optical frame */
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ]
}

/**
 * Foxglove 3D “Default” image projection:
 * - Distance: depth along optical axis for the flat plane
 * - Planar projection factor ∈ [0,1]: 0 = spherical (equidistant rays), 1 = flat Z=d
 * @see https://docs.foxglove.dev/docs/visualization/panels/3d
 *
 * Camera optical (ROS CameraInfo): +X right, +Y down, +Z into the scene.
 */
export function computeFrustumCorners(
  info: DecodedCameraInfo,
  distance: number,
  planarFactor: number,
): FrustumCornersRos | null {
  const fx = info.K[0]
  const fy = info.K[4]
  const cx = info.K[2]
  const cy = info.K[5]
  const w = info.width
  const h = info.height
  if (!(fx > 0) || !(fy > 0) || !(distance > 0) || !w || !h) return null

  const uvs: Array<[number, number]> = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]

  const alpha = Math.min(1, Math.max(0, planarFactor))
  const corners = uvs.map(([u, v]) => {
    const flat: [number, number, number] = [
      ((u - cx) / fx) * distance,
      ((v - cy) / fy) * distance,
      distance,
    ]
    const len = Math.hypot(flat[0], flat[1], flat[2]) || 1
    const spherical: [number, number, number] = [
      (flat[0] / len) * distance,
      (flat[1] / len) * distance,
      (flat[2] / len) * distance,
    ]
    return [
      flat[0] * alpha + spherical[0] * (1 - alpha),
      flat[1] * alpha + spherical[1] * (1 - alpha),
      flat[2] * alpha + spherical[2] * (1 - alpha),
    ] as [number, number, number]
  }) as FrustumCornersRos['corners']

  return { origin: [0, 0, 0], corners }
}
