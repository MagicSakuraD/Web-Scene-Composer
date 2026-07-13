import * as THREE from 'three'

/**
 * Isaac Sim Nova Carter 官方差速参数（Differential Controller / Robot Assets 文档）
 * - 轮半径 0.14 m
 * - 轮距 0.413 m
 */
export const DRIVE_WHEEL_RADIUS = 0.14
export const CASTER_WHEEL_RADIUS = 0.14
export const DRIVE_TRACK_WIDTH = 0.813
export const DRIVE_TRACK_HALF_WIDTH = DRIVE_TRACK_WIDTH / 2

/** @deprecated 使用 DRIVE_WHEEL_RADIUS */
export const WHEEL_RADIUS = DRIVE_WHEEL_RADIUS

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

export interface WheelSpinTargets {
  driveLeft: THREE.Object3D | null
  driveRight: THREE.Object3D | null
  casterLeft: THREE.Object3D | null
  casterRight: THREE.Object3D | null
}

/** 在 animRoot 子树中收集四个滚动轮（一次 traverse，可缓存） */
export function collectWheelSpinTargets(root: THREE.Object3D): WheelSpinTargets {
  const targets: WheelSpinTargets = {
    driveLeft: null,
    driveRight: null,
    casterLeft: null,
    casterRight: null,
  }

  root.traverse((obj) => {
    const name = obj.name?.toLowerCase() ?? ''
    if (name === 'wheel_left') targets.driveLeft = obj
    else if (name === 'wheel_right') targets.driveRight = obj
    else if (name === 'caster_wheel_left') targets.casterLeft = obj
    else if (name === 'caster_wheel_right') targets.casterRight = obj
  })

  return targets
}

/**
 * 用 odom twist 做轮子 Dead Reckoning（高频、顺滑）。
 * TF 只负责 caster_swivel 转向；滚动在本地算，避免兄弟节点 TF 结构难拆 roll。
 */
export function applyWheelSpinFromOdom(
  targets: WheelSpinTargets,
  linearX: number,
  angularZ: number,
  deltaSec: number,
) {
  if (deltaSec <= 0) return

  const vLeft = linearX - angularZ * DRIVE_TRACK_HALF_WIDTH
  const vRight = linearX + angularZ * DRIVE_TRACK_HALF_WIDTH
  const vCaster = linearX

  if (targets.driveLeft) {
    applyWheelSpin(targets.driveLeft, (vLeft / DRIVE_WHEEL_RADIUS) * deltaSec)
  }
  if (targets.driveRight) {
    applyWheelSpin(targets.driveRight, (vRight / DRIVE_WHEEL_RADIUS) * deltaSec)
  }
  if (targets.casterLeft) {
    applyWheelSpin(targets.casterLeft, (vCaster / CASTER_WHEEL_RADIUS) * deltaSec)
  }
  if (targets.casterRight) {
    applyWheelSpin(targets.casterRight, (vCaster / CASTER_WHEEL_RADIUS) * deltaSec)
  }
}
