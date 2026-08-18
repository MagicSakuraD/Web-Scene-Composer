import * as THREE from 'three'
import { rosPositionToThree } from '@/lib/ros/ros-three-coords'
import { getSceneFixedFrameNow } from '@/lib/ros/playback-display-frame'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import { NAV_MAP_FRAME } from '@/lib/ros/nav-goal-config'

const _scratch = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _qa = new THREE.Quaternion()
const _composedT = new THREE.Vector3()
const _composedQ = new THREE.Quaternion()
const _yawEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const _rosEuler = new THREE.Euler()

const IDENTITY_T: RosTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
}

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

/** parent_T_child = parent * child（ROS 位姿乘法） */
function composeRosPose(
  parent: RosTransform,
  childPos: { x: number; y: number; z: number },
  childOri: { x: number; y: number; z: number; w: number },
  outT: THREE.Vector3,
  outQ: THREE.Quaternion,
) {
  _qa.set(parent.rotation.x, parent.rotation.y, parent.rotation.z, parent.rotation.w)
  outQ.set(childOri.x, childOri.y, childOri.z, childOri.w)
  outQ.premultiply(_qa)
  outT.set(childPos.x, childPos.y, childPos.z).applyQuaternion(_qa)
  outT.x += parent.translation.x
  outT.y += parent.translation.y
  outT.z += parent.translation.z
}

function lookupFixedFromSource(sourceFrame: string): RosTransform {
  const frame = normalizeRosFrameId(sourceFrame)
  const fixed = getSceneFixedFrameNow()
  if (!fixed || !frame || fixed === frame) return IDENTITY_T
  return tfRuntimeStore.lookupTransform(fixed, frame) ?? IDENTITY_T
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
  const T = lookupFixedFromSource(frameId)
  if (T !== IDENTITY_T) {
    applyRosTransformToPoint(T, rosX, rosY, rosZ, out)
    return rosPositionToThree(out.x, out.y, out.z, out)
  }
  return rosPositionToThree(rosX, rosY, rosZ, out)
}

/**
 * OccupancyGrid origin → Three 水平位姿。
 * 先把 origin 从 grid.frame_id 变到 Fixed Frame（含旋转），再 ROS→Three。
 * 平面几何已做 Z-up→Y-up，这里只把 ROS yaw 映到 Three Y。
 */
export function rosOccupancyOriginToThree(
  frameId: string,
  originPos: { x: number; y: number; z: number },
  originOri: { x: number; y: number; z: number; w: number },
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
) {
  const T = lookupFixedFromSource(frameId)
  composeRosPose(T, originPos, originOri, _composedT, _composedQ)
  rosPositionToThree(_composedT.x, _composedT.y, _composedT.z, outPos)
  _rosEuler.setFromQuaternion(_composedQ, 'ZYX')
  _yawEuler.set(0, _rosEuler.z, 0)
  outQuat.setFromEuler(_yawEuler)
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
