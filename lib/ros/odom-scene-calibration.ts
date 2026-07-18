import * as THREE from 'three'

/**
 * odom 水平位移增量 (Δx, Δz) 是否取反（绕 Three Y-up 等价转 180°）。
 *
 * 方案 B：显示位姿 = 场景起点 + (当前 odom − odom 起点)。
 * 朝向用四元数增量，不经此开关；若静止朝向正确、运动位移反了，应保持 false。
 * 仅当 GLB 前向与 ROS X 前经坐标变换后仍水平相反时再改 true。
 */
export const ODOM_DELTA_FLIP_XZ = false

/**
 * 方案 B：GLB 静态位姿（Isaac 导出）与 odom 原点对齐。
 * 首帧记录场景世界位姿与首条 odom，之后用 odom 增量驱动，避免 odom/map 原点不一致导致跳变。
 */
class OdomSceneCalibration {
  sceneCaptured = false
  odomCaptured = false

  private readonly sceneOriginPos = new THREE.Vector3()
  private readonly sceneOriginQuat = new THREE.Quaternion()
  private readonly odomOriginPos = new THREE.Vector3()
  private readonly odomOriginQuat = new THREE.Quaternion()

  private readonly deltaPos = new THREE.Vector3()
  private readonly deltaQuat = new THREE.Quaternion()
  private readonly outPos = new THREE.Vector3()
  private readonly outQuat = new THREE.Quaternion()

  reset() {
    this.sceneCaptured = false
    this.odomCaptured = false
  }

  /** 连接后首帧：记录 GLB 里机器人的世界位姿（与 Isaac 场景摆放一致） */
  captureSceneOrigin(obj: THREE.Object3D) {
    if (this.sceneCaptured) return
    obj.updateMatrixWorld(true)
    obj.getWorldPosition(this.sceneOriginPos)
    obj.getWorldQuaternion(this.sceneOriginQuat)
    this.sceneCaptured = true
  }

  /** 首条 odom：记录 odom 坐标系下的起点 */
  captureOdomOrigin(odomPos: THREE.Vector3, odomQuat: THREE.Quaternion) {
    if (!this.sceneCaptured || this.odomCaptured) return
    this.odomOriginPos.copy(odomPos)
    this.odomOriginQuat.copy(odomQuat)
    this.odomCaptured = true
  }

  isReady(): boolean {
    return this.sceneCaptured && this.odomCaptured
  }

  /**
   * 显示位姿 = 场景起点 + (当前 odom − odom 起点)
   * 显示朝向 = 场景起点朝向 × (odom 起点→当前的旋转增量)
   */
  computeDisplayPose(
    currentOdomPos: THREE.Vector3,
    currentOdomQuat: THREE.Quaternion,
    outPos = this.outPos,
    outQuat = this.outQuat,
  ) {
    this.deltaPos.copy(currentOdomPos).sub(this.odomOriginPos)
    if (ODOM_DELTA_FLIP_XZ) {
      this.deltaPos.x *= -1
      this.deltaPos.z *= -1
    }
    outPos.copy(this.sceneOriginPos).add(this.deltaPos)

    this.deltaQuat.copy(this.odomOriginQuat).invert().multiply(currentOdomQuat)
    outQuat.copy(this.sceneOriginQuat).multiply(this.deltaQuat)

    return { pos: outPos, quat: outQuat }
  }

  /**
   * odom 坐标系下的点 → 与小车相同的场景显示坐标（方案 B 线性映射）。
   * 用于 /local_plan（Nav2 局部路径通常在 odom 系，非 map）。
   */
  odomRosPointToSceneThree(
    rosX: number,
    rosY: number,
    rosZ: number,
    out = this.outPos,
  ): THREE.Vector3 {
    if (!this.isReady()) {
      return out.set(rosX, rosZ, -rosY)
    }
    this.deltaPos.set(rosX, rosZ, -rosY).sub(this.odomOriginPos)
    if (ODOM_DELTA_FLIP_XZ) {
      this.deltaPos.x *= -1
      this.deltaPos.z *= -1
    }
    return out.copy(this.sceneOriginPos).add(this.deltaPos)
  }
}

export const odomSceneCalibration = new OdomSceneCalibration()
