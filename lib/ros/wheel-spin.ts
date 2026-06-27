import * as THREE from 'three'

/** Nova Carter 轮子半径（Dead Reckoning 用） */
export const WHEEL_RADIUS = 0.1

/** Nova Carter 驱动轮 / 万向轮滚动轴（本地 Z） */
export const WHEEL_SPIN_AXIS = new THREE.Vector3(0, 0, 1)

export interface WheelSpinState {
  axis: THREE.Vector3
  angle: number
  restQuaternion: THREE.Quaternion
}

export function isDriveWheelName(name: string): boolean {
  return /^(wheel|drive_wheel)_(left|right)$/i.test(name)
}

export function isCasterWheelName(name: string): boolean {
  return /^caster_wheel_(left|right)$/i.test(name)
}

export function isWheelSpinName(name: string): boolean {
  return isDriveWheelName(name) || isCasterWheelName(name)
}

/** @deprecated 使用 isDriveWheelName / isCasterWheelName */
export function isWheelMeshName(name: string): boolean {
  return isWheelSpinName(name)
}

export function initWheelSpinState(wheel: THREE.Object3D): WheelSpinState {
  const existing = wheel.userData.wheelSpin as WheelSpinState | undefined
  if (existing) return existing

  const state: WheelSpinState = {
    axis: WHEEL_SPIN_AXIS.clone(),
    angle: 0,
    restQuaternion: wheel.quaternion.clone(),
  }
  wheel.userData.wheelSpin = state
  return state
}

/** attach 后 local 姿态变了，必须在新父节点下重新捕获 rest */
export function invalidateWheelSpinState(wheel: THREE.Object3D) {
  delete wheel.userData.wheelSpin
}

/** 在 glTF 初始姿态基础上，仅绕轮轴（Z）旋转 */
export function applyWheelSpin(wheel: THREE.Object3D, deltaAngle: number) {
  if (Math.abs(deltaAngle) < 1e-9) return

  const state = initWheelSpinState(wheel)
  state.angle += deltaAngle

  wheel.quaternion.copy(state.restQuaternion)
  wheel.rotateOnAxis(state.axis, state.angle)
}

export function resetWheelSpinStates(root: THREE.Object3D) {
  root.traverse((child) => {
    const state = child.userData.wheelSpin as WheelSpinState | undefined
    if (state) {
      child.quaternion.copy(state.restQuaternion)
      delete child.userData.wheelSpin
    }
  })
}
