import * as THREE from 'three'
import { rosPositionToThree } from '@/lib/ros/ros-three-coords'
import { getSceneFixedFrameNow } from '@/lib/ros/playback-display-frame'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import { NAV_MAP_FRAME } from '@/lib/ros/nav-goal-config'

const _scratch = new THREE.Vector3()
const _q = new THREE.Quaternion()

export function normalizeRosFrameId(frameId: string): string {
  const id = frameId.trim()
  if (!id) return NAV_MAP_FRAME
  return id.startsWith('/') ? id.slice(1) : id
}

function applyRosTransformToPoint(
  T: RosTransform,
  x: number,
  y: number,
  z: number,
  out: THREE.Vector3,
) {
  _q.set(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
  out.set(x, y, z).applyQuaternion(_q)
  out.x += T.translation.x
  out.y += T.translation.y
  out.z += T.translation.z
}

/**
 * Path / costmap 原点 → Three 场景坐标。
 * 与 TF 轴、GLB 相同：先 lookup(fixedFrame, pathFrame)，再 ROS→Three。
 */
export function rosPathPointToSceneThree(
  rosX: number,
  rosY: number,
  rosZ: number,
  frameId: string,
  out = _scratch,
): THREE.Vector3 {
  const frame = normalizeRosFrameId(frameId)
  const fixed = getSceneFixedFrameNow()

  if (fixed && frame && fixed !== frame) {
    const T = tfRuntimeStore.lookupTransform(fixed, frame)
    if (T) {
      applyRosTransformToPoint(T, rosX, rosY, rosZ, out)
      return rosPositionToThree(out.x, out.y, out.z, out)
    }
  }

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
