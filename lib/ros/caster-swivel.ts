import * as THREE from 'three'
import { invalidateWheelSpinState } from '@/lib/ros/wheel-spin'

/**
 * 万向轮支架转向轴（**支架节点局部坐标**）。
 * 调试时在控制台执行 `window.casterSwivelDebug = true`，看 [CasterSwivel] 日志里哪条局部轴最接近世界 Y↑。
 *
 * 常见取值（逐个试）：
 *   (0, 1, 0) — 局部 Y（当前默认）
 *   (0, 0, 1) — 局部 Z（若看起来像在绕 Z 滚，反而应试这个）
 *   (1, 0, 0) — 局部 X
 */
export const SWIVEL_AXIS = new THREE.Vector3(1, 0, 0)

/**
 * 单次转向 S 曲线时长（秒）。越大整体越慢。
 * 类似 AE 里拉长两个关键帧之间的间距。
 */
export const SWIVEL_STEER_DURATION = 4

/**
 * 贝塞尔缓动控制点 — 等价 CSS cubic-bezier(p1x, p1y, p2x, p2y)。
 * 默认 (0.42, 0, 0.58, 1) ≈ ease-in-out：两头慢、中间快。
 * 想要更「肉」的加减速：试 (0.25, 0.1, 0.75, 0.9) ；更跟手：(0.33, 0, 0.67, 1)
 */
export const SWIVEL_EASE = { p1x: 0.25, p1y: 0.1, p2x: 0.75, p2y: 1 } as const

/** 目标角变化超过此值（弧度）才开新一段 S 曲线，避免抖动频繁重启 */
export const SWIVEL_RETARGET_THRESHOLD = 0.07

/** @deprecated 已改用 SWIVEL_STEER_DURATION + 贝塞尔缓动 */
export const SWIVEL_STEER_LERP = 0.06

/** 标准 ease-in-out 贝塞尔：输入/输出均为 0~1 时间进度 */
function cubicBezierEase(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
): number {
  t = Math.max(0, Math.min(1, t))
  if (t <= 0) return 0
  if (t >= 1) return 1

  const sampleX = (u: number) => {
    const om = 1 - u
    return 3 * om * om * u * p1x + 3 * om * u * u * p2x + u * u * u
  }
  const sampleY = (u: number) => {
    const om = 1 - u
    return 3 * om * om * u * p1y + 3 * om * u * u * p2y + u * u * u
  }

  // 反解 Bx(u) = t
  let lo = 0
  let hi = 1
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) * 0.5
    if (sampleX(mid) < t) lo = mid
    else hi = mid
  }
  return sampleY((lo + hi) * 0.5)
}

function easeSwivelProgress(t: number): number {
  const { p1x, p1y, p2x, p2y } = SWIVEL_EASE
  return cubicBezierEase(t, p1x, p1y, p2x, p2y)
}

/** 浏览器控制台：window.casterSwivelDebug = true / false */
export function isCasterSwivelDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as unknown as { casterSwivelDebug?: boolean }
  if (w.casterSwivelDebug !== undefined) return w.casterSwivelDebug
  return process.env.NODE_ENV === 'development'
}

const _axisWorld = new THREE.Vector3()
const _localX = new THREE.Vector3()
const _localY = new THREE.Vector3()
const _localZ = new THREE.Vector3()
const _debugEuler = new THREE.Euler()
const _swivelDebugLastLog = new Map<string, number>()

/** 首次捕获 rest 姿态时打印一次，用于确认该绕哪根局部轴转 */
export function logSwivelAxisDiagnostic(swivel: THREE.Object3D, axis: THREE.Vector3) {
  const q = swivel.quaternion.clone()

  _localX.set(1, 0, 0).applyQuaternion(q)
  _localY.set(0, 1, 0).applyQuaternion(q)
  _localZ.set(0, 0, 1).applyQuaternion(q)
  _axisWorld.copy(axis).applyQuaternion(q).normalize()

  const up = new THREE.Vector3(0, 1, 0)
  const score = (v: THREE.Vector3) => Math.abs(v.dot(up))

  console.group(`[CasterSwivel] ${swivel.name} 轴向诊断（只打一次）`)
  console.log('rest quaternion', q.toArray().map((v) => +v.toFixed(4)))
  console.log('rest euler (deg)', {
    x: +THREE.MathUtils.radToDeg(swivel.rotation.x).toFixed(2),
    y: +THREE.MathUtils.radToDeg(swivel.rotation.y).toFixed(2),
    z: +THREE.MathUtils.radToDeg(swivel.rotation.z).toFixed(2),
  })
  console.log('局部轴在世界空间中的方向（找最接近竖直 Y 的那根）', {
    localX: _localX.toArray().map((v) => +v.toFixed(3)),
    localY: _localY.toArray().map((v) => +v.toFixed(3)),
    localZ: _localZ.toArray().map((v) => +v.toFixed(3)),
  })
  console.log('与世界上方向 (0,1,0) 对齐程度 0~1', {
    localX: +score(_localX).toFixed(3),
    localY: +score(_localY).toFixed(3),
    localZ: +score(_localZ).toFixed(3),
  })
  console.log('当前 SWIVEL_AXIS (局部)', axis.toArray(), '→ 世界', _axisWorld.toArray().map((v) => +v.toFixed(3)))
  console.log(
    '修改方式: lib/ros/caster-swivel.ts 顶部 SWIVEL_AXIS.set(x,y,z)，保存刷新。得分最高的局部轴通常就是正确转向轴。',
  )
  console.groupEnd()
}

function logSwivelSteerDebug(
  swivel: THREE.Object3D,
  axis: THREE.Vector3,
  steerAngle: number,
  targetSteer: number,
  easedT: number,
) {
  if (!isCasterSwivelDebugEnabled()) return

  const now = performance.now()
  const last = _swivelDebugLastLog.get(swivel.name) ?? 0
  if (now - last < 800) return
  _swivelDebugLastLog.set(swivel.name, now)

  _debugEuler.setFromQuaternion(swivel.quaternion, 'XYZ')
  _axisWorld.copy(axis).applyQuaternion(swivel.quaternion).normalize()

  console.log(`[CasterSwivel] ${swivel.name} 转向`, {
    steerAngleDeg: +THREE.MathUtils.radToDeg(steerAngle).toFixed(1),
    targetSteerDeg: +THREE.MathUtils.radToDeg(targetSteer).toFixed(1),
    easedProgress: +easedT.toFixed(3),
    eulerAfterDeg: {
      x: +THREE.MathUtils.radToDeg(_debugEuler.x).toFixed(1),
      y: +THREE.MathUtils.radToDeg(_debugEuler.y).toFixed(1),
      z: +THREE.MathUtils.radToDeg(_debugEuler.z).toFixed(1),
    },
    swivelAxisLocal: axis.toArray(),
    swivelAxisWorld: _axisWorld.toArray().map((v) => +v.toFixed(3)),
  })
}

export interface CasterSwivelState {
  restQuaternion: THREE.Quaternion
  axis: THREE.Vector3
  /** glTF 初始姿态下，支架参考方向在父节点 XZ 平面内的航向角 */
  restHeading: number
  /** 相对 rest 的额外转向角（绕 axis） */
  steerAngle: number
  /** 当前 S 曲线段起点 / 终点 / 已用时长 */
  animFrom: number
  animTo: number
  animElapsed: number
}

const _chassisWorldQuat = new THREE.Quaternion()
const _invRefQuat = new THREE.Quaternion()
const _velocityWorld = new THREE.Vector3()
const _localDir = new THREE.Vector3()
const _forkDir = new THREE.Vector3()

export function isCasterSwivelName(name: string): boolean {
  return /^caster_swivel_(left|right)$/i.test(name)
}

function sideFromSwivelName(name: string): 'left' | 'right' | null {
  const lower = name.toLowerCase()
  if (lower.endsWith('_left')) return 'left'
  if (lower.endsWith('_right')) return 'right'
  return null
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = to - from
  while (diff > Math.PI) diff -= 2 * Math.PI
  while (diff < -Math.PI) diff += 2 * Math.PI
  return diff
}

function beginSteerAnimation(state: CasterSwivelState, from: number, to: number) {
  state.animFrom = from
  state.animTo = to
  state.animElapsed = 0
}

function normalizeAngle(angle: number): number {
  let a = angle
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

function getSwivelState(swivel: THREE.Object3D): CasterSwivelState {
  const existing = swivel.userData.casterSwivel as CasterSwivelState | undefined
  if (existing) return existing

  const restQuaternion = swivel.quaternion.clone()
  _forkDir.set(0, 0, 1).applyQuaternion(restQuaternion)
  const restHeading = Math.atan2(_forkDir.x, _forkDir.z)

  const axis = SWIVEL_AXIS.clone()
  const state: CasterSwivelState = {
    restQuaternion,
    axis,
    restHeading,
    steerAngle: 0,
    animFrom: 0,
    animTo: 0,
    animElapsed: SWIVEL_STEER_DURATION,
  }
  swivel.userData.casterSwivel = state

  if (isCasterSwivelDebugEnabled()) {
    logSwivelAxisDiagnostic(swivel, axis)
  }

  return state
}

/**
 * odom 绑定目标可能是 asset-ref / chassis_link；动画节点统一在 Nova_Carter_ROS 子树里。
 */
export function resolveRobotAnimRoot(target: THREE.Object3D): THREE.Object3D {
  if (/^Nova_Carter_ROS$/i.test(target.name)) return target
  const nova = target.getObjectByName('Nova_Carter_ROS')
  return nova ?? target
}

/**
 * glTF 里 caster_swivel 与 caster_wheel 常为平级兄弟节点。
 * attach 在保持世界位姿不变的前提下，把轮子挂到支架下面。
 */
export function bindCasterWheelsToSwivels(
  swivels: THREE.Object3D[],
  casterWheels: THREE.Object3D[],
): THREE.Object3D[] {
  const attached: THREE.Object3D[] = []
  if (swivels.length === 0 || casterWheels.length === 0) return attached

  swivels[0].parent?.updateMatrixWorld(true)

  for (const swivel of swivels) {
    const side = sideFromSwivelName(swivel.name)
    if (!side) continue

    const wheel = casterWheels.find((w) => w.name.toLowerCase() === `caster_wheel_${side}`)
    if (!wheel) continue

    if (wheel.parent === swivel) {
      attached.push(wheel)
      continue
    }

    swivel.updateMatrixWorld(true)
    wheel.updateMatrixWorld(true)
    swivel.attach(wheel)
    invalidateWheelSpinState(wheel)
    attached.push(wheel)
  }

  return attached
}

/** 是否所有万向轮都已挂到对应支架下 */
export function areCasterWheelsBound(swivels: THREE.Object3D[]): boolean {
  if (swivels.length === 0) return false
  return swivels.every((swivel) => {
    const side = sideFromSwivelName(swivel.name)
    if (!side) return false
    const wheel = swivel.children.find(
      (c) => c.name.toLowerCase() === `caster_wheel_${side}`,
    )
    return !!wheel
  })
}

/**
 * 底盘瞬时行进方向（世界水平面，已归一化）。
 * 优先位置差分；静止时回退 odom twist。
 */
export function computeChassisTravelDirectionWorld(
  chassis: THREE.Object3D,
  chassisDeltaWorld: THREE.Vector3,
  linearX: number,
  angularZ: number,
  moveThreshold: number,
  out: THREE.Vector3,
): boolean {
  out.set(chassisDeltaWorld.x, 0, chassisDeltaWorld.z)
  if (out.lengthSq() >= moveThreshold * moveThreshold) {
    out.normalize()
    return true
  }

  if (Math.abs(linearX) < 0.005 && Math.abs(angularZ) < 0.005) return false

  chassis.getWorldQuaternion(_chassisWorldQuat)

  if (Math.abs(linearX) >= 0.005) {
    _velocityWorld.set(linearX, 0, 0).applyQuaternion(_chassisWorldQuat)
    out.set(_velocityWorld.x, 0, _velocityWorld.z)
    if (out.lengthSq() >= 1e-8) {
      out.normalize()
      return true
    }
  }

  _velocityWorld.set(0, 0, 1).applyQuaternion(_chassisWorldQuat)
  out.set(_velocityWorld.x, 0, _velocityWorld.z)
  if (out.lengthSq() < 1e-8) return false
  out.normalize()
  if (angularZ < 0) out.multiplyScalar(-1)
  return true
}

/**
 * 被动万向轮支架：贝塞尔 S 曲线缓入缓出转向（先加减速）。
 * 子节点 caster_wheel 在 bindCasterWheelsToSwivels 之后随支架一起转。
 */
export function updateCasterSwivel(
  swivel: THREE.Object3D,
  chassis: THREE.Object3D,
  travelDirWorld: THREE.Vector3,
  delta = 1 / 60,
) {
  const state = getSwivelState(swivel)

  _localDir.copy(travelDirWorld)
  const ref = swivel.parent ?? chassis
  ref.updateMatrixWorld(true)
  ref.getWorldQuaternion(_invRefQuat)
  _invRefQuat.invert()
  _localDir.applyQuaternion(_invRefQuat)
  _localDir.y = 0
  if (_localDir.lengthSq() < 1e-10) return
  _localDir.normalize()

  const targetHeading = Math.atan2(_localDir.x, _localDir.z) + Math.PI
  const targetSteer = normalizeAngle(targetHeading - state.restHeading)

  const retargetDelta = Math.abs(shortestAngleDiff(state.animTo, targetSteer))
  if (retargetDelta > SWIVEL_RETARGET_THRESHOLD) {
    beginSteerAnimation(state, state.steerAngle, targetSteer)
  }

  state.animElapsed = Math.min(state.animElapsed + delta, SWIVEL_STEER_DURATION)
  const linearT = state.animElapsed / SWIVEL_STEER_DURATION
  const easedT = easeSwivelProgress(linearT)
  state.steerAngle = state.animFrom + shortestAngleDiff(state.animFrom, state.animTo) * easedT

  swivel.quaternion.copy(state.restQuaternion)
  swivel.rotateOnAxis(state.axis, state.steerAngle)

  logSwivelSteerDebug(swivel, state.axis, state.steerAngle, targetSteer, easedT)
}

export function resetCasterSwivelStates(root: THREE.Object3D) {
  root.traverse((child) => {
    const state = child.userData.casterSwivel as CasterSwivelState | undefined
    if (state) {
      child.quaternion.copy(state.restQuaternion)
      delete child.userData.casterSwivel
    }
  })
}
