import * as THREE from 'three'

/**
 * odom 水平位移增量 (Δx, Δz) 是否取反。
 * Isaac 向前 / 向左 与 Three 场景相反时可先试 true。
 */
export const ODOM_DELTA_FLIP_XZ = true

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
}

export const odomSceneCalibration = new OdomSceneCalibration()
