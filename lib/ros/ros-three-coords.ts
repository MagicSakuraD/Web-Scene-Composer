import * as THREE from 'three'

/**
 * ROS REP-103 / Isaac Sim（X 前, Y 左, Z 上）
 * → Three.js glTF（X 右, Y 上, Z 前）
 *
 * 等价于绕 X 轴旋转 -90°：把 ROS 的 Z 轴映射到 Three 的 Y 轴。
 */
const ROS_TO_THREE_Q = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2,
)

/** ROS position → Three.js position */
export function rosPositionToThree(
  x: number,
  y: number,
  z: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.set(x, z, -y)
}

/** ROS quaternion → Three.js quaternion（世界/根位姿） */
export function rosQuaternionToThree(
  x: number,
  y: number,
  z: number,
  w: number,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  const qRos = new THREE.Quaternion(x, y, z, w)
  return out.copy(ROS_TO_THREE_Q).multiply(qRos)
}

/**
 * 父→子相对旋转（TF 关节）ROS → Three.js。
 * 用共轭变换 q_three = C · q_ros · C⁻¹，而非世界位姿用的 C · q_ros。
 */
export function rosRelativeQuaternionToThree(
  x: number,
  y: number,
  z: number,
  w: number,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  const qRos = new THREE.Quaternion(x, y, z, w)
  return out.copy(ROS_TO_THREE_Q).multiply(qRos).multiply(THREE_TO_ROS_Q)
}

const THREE_TO_ROS_Q = ROS_TO_THREE_Q.clone().invert()

/** Three.js position → ROS map position */
export function threePositionToRos(
  x: number,
  y: number,
  z: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  return out.set(x, -z, y)
}

/** Three.js quaternion → ROS map quaternion */
export function threeQuaternionToRos(
  x: number,
  y: number,
  z: number,
  w: number,
  out = new THREE.Quaternion(),
): THREE.Quaternion {
  const qThree = new THREE.Quaternion(x, y, z, w)
  return out.copy(THREE_TO_ROS_Q).multiply(qThree)
}

/** World-space Three.js object → ROS PoseStamped fields */
export function threeWorldPoseToRos(
  object: THREE.Object3D,
  frameId: string,
  stampSec = 0,
  stampNsec = 0,
) {
  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  object.getWorldPosition(pos)
  object.getWorldQuaternion(quat)
  const rosPos = threePositionToRos(pos.x, pos.y, pos.z)
  const rosQuat = threeQuaternionToRos(quat.x, quat.y, quat.z, quat.w)
  return {
    header: { stamp: { sec: stampSec, nanosec: stampNsec }, frame_id: frameId },
    pose: {
      position: { x: rosPos.x, y: rosPos.y, z: rosPos.z },
      orientation: {
        x: rosQuat.x,
        y: rosQuat.y,
        z: rosQuat.z,
        w: rosQuat.w,
      },
    },
  }
}

/**
 * 批量点坐标：Isaac Sim / ROS REP-103 (X前 Y左 Z上) → Three.js Y-up (x, z, -y)。
 * 用于 PointCloud2 写入 GPU 缓冲；与 odom 使用的 rosPositionToThree 一致。
 */
export function rosPointsToThreeBuffer(
  src: Float32Array,
  dst: Float32Array,
  pointCount: number,
): { minY: number; maxY: number } {
  let minY = Infinity
  let maxY = -Infinity
  const n = pointCount * 3
  for (let i = 0; i < n; i += 3) {
    const x = src[i]
    const y = src[i + 1]
    const z = src[i + 2]
    const threeY = z
    dst[i] = x
    dst[i + 1] = threeY
    dst[i + 2] = -y
    if (threeY < minY) minY = threeY
    if (threeY > maxY) maxY = threeY
  }
  if (!Number.isFinite(minY)) minY = 0
  if (!Number.isFinite(maxY)) maxY = 1
  return { minY, maxY }
}
