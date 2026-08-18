import * as THREE from 'three'

/**
 * ROS REP-103 / Isaac Sim（X 前, Y 左, Z 上）
 * → Three.js glTF（X 右, Y 上, Z 前）
 *
 * 等价于绕 X 轴旋转 -90°：把 ROS 的 Z 轴映射到 Three 的 Y 轴。
 * 亦可作 Group.quaternion，包住原始 ROS 位姿/尺寸（与 Foxglove CubePrimitive 一致）。
 */
export const ROS_TO_THREE_Q = new THREE.Quaternion().setFromAxisAngle(
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
 * ROS 位姿（与 TF axes 同一套：C · p、C · q）→ Three 世界位姿。
 * 用于把 lookupTransform / odom 结果写到 GLB 根节点。
 */
export function rosTransformToThreeWorld(
  translation: { x: number; y: number; z: number },
  rotation: { x: number; y: number; z: number; w: number },
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
) {
  rosPositionToThree(translation.x, translation.y, translation.z, outPos)
  rosQuaternionToThree(rotation.x, rotation.y, rotation.z, rotation.w, outQuat)
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

/** ROS 平面朝向（绕 Z，弧度） */
export function rosYawFromQuaternion(q: { x: number; y: number; z: number; w: number }): number {
  return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z))
}

/** Three.js 节点欧拉角（度）→ ROS map yaw（弧度） */
export function threeEulerDegToRosYaw(rotationDeg: [number, number, number]): number {
  const e = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationDeg[0]),
    THREE.MathUtils.degToRad(rotationDeg[1]),
    THREE.MathUtils.degToRad(rotationDeg[2]),
  )
  const q = new THREE.Quaternion().setFromEuler(e)
  const ros = threeQuaternionToRos(q.x, q.y, q.z, q.w)
  return rosYawFromQuaternion(ros)
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
