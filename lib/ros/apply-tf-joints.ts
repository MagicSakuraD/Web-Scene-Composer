import * as THREE from 'three'
import { bindCasterWheelsToSwivels } from '@/lib/ros/caster-swivel'
import { TF_FRAME_ALIASES, TF_WHEEL_CHILD_FRAMES } from '@/lib/ros/tf-config'
import { ODOM_DELTA_FLIP_XZ } from '@/lib/ros/odom-scene-calibration'
import { tfRuntimeStore, type TfEdge } from '@/lib/ros/tf-runtime-store'
import { rosPositionToThree, rosRelativeQuaternionToThree } from '@/lib/ros/ros-three-coords'

const _dqRos = new THREE.Quaternion()
const _dqThree = new THREE.Quaternion()
const _dtThree = new THREE.Vector3()
const _qCurrent = new THREE.Quaternion()
const _euler = new THREE.Euler()

const SWIVEL_DEBUG_THROTTLE_MS = 500
let lastSwivelDebugAt = 0
let loggedMissingOnce = false
let hierarchyBoundRoot: THREE.Object3D | null = null

interface TfJointCalib {
  restPos: THREE.Vector3
  restQuat: THREE.Quaternion
  originT: { x: number; y: number; z: number }
  originQ: THREE.Quaternion
}

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

function isCasterSwivelFrame(frameId: string): boolean {
  return /^caster_swivel_(left|right)$/i.test(frameId)
}

function isSwivelDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as unknown as { tfDebugSwivel?: boolean }).tfDebugSwivel
}

function quatToLog(q: THREE.Quaternion) {
  return {
    x: +q.x.toFixed(6),
    y: +q.y.toFixed(6),
    z: +q.z.toFixed(6),
    w: +q.w.toFixed(6),
  }
}

function eulerDegToLog(obj: THREE.Object3D) {
  _euler.setFromQuaternion(obj.quaternion, 'XYZ')
  return {
    x: +THREE.MathUtils.radToDeg(_euler.x).toFixed(2),
    y: +THREE.MathUtils.radToDeg(_euler.y).toFixed(2),
    z: +THREE.MathUtils.radToDeg(_euler.z).toFixed(2),
  }
}

/** 在子树中按 TF frame 别名查找 Object3D（按 aliases 顺序优先，避免根节点 Nova_Carter_ROS 抢先匹配 base_link） */
export function findObjectByTfFrame(root: THREE.Object3D, frameId: string): THREE.Object3D | null {
  const key = normalizeFrameId(frameId)
  const aliases = TF_FRAME_ALIASES[key] ?? [key]

  for (const alias of aliases) {
    const needle = alias.toLowerCase()
    if (root.name && root.name.toLowerCase() === needle) return root
    let found: THREE.Object3D | null = null
    root.traverse((obj) => {
      if (found || obj === root || !obj.name) return
      if (obj.name.toLowerCase() === needle) found = obj
    })
    if (found) return found
  }

  return null
}

function getOrCaptureJointCalib(child: THREE.Object3D, edge: TfEdge): TfJointCalib {
  const existing = child.userData.tfJointCalib as TfJointCalib | undefined
  if (existing) return existing

  const calib: TfJointCalib = {
    restPos: child.position.clone(),
    restQuat: child.quaternion.clone(),
    originT: { ...edge.transform.translation },
    originQ: new THREE.Quaternion(
      edge.transform.rotation.x,
      edge.transform.rotation.y,
      edge.transform.rotation.z,
      edge.transform.rotation.w,
    ),
  }
  child.userData.tfJointCalib = calib
  return calib
}

function applyTranslationDelta(child: THREE.Object3D, calib: TfJointCalib, edge: TfEdge) {
  const t = edge.transform.translation
  _dtThree.set(
    t.x - calib.originT.x,
    t.y - calib.originT.y,
    t.z - calib.originT.z,
  )
  rosPositionToThree(_dtThree.x, _dtThree.y, _dtThree.z, _dtThree)
  if (ODOM_DELTA_FLIP_XZ) {
    _dtThree.x *= -1
    _dtThree.z *= -1
  }
  child.position.copy(calib.restPos).add(_dtThree)
}

/**
 * 万向轮支架：完整 TF 增量（含绕 Y 转向）。
 */
function applySwivelFromTf(child: THREE.Object3D, edge: TfEdge) {
  const calib = getOrCaptureJointCalib(child, edge)
  const r = edge.transform.rotation

  applyTranslationDelta(child, calib, edge)

  _qCurrent.set(r.x, r.y, r.z, r.w)
  _dqRos.copy(calib.originQ).invert().multiply(_qCurrent)
  rosRelativeQuaternionToThree(_dqRos.x, _dqRos.y, _dqRos.z, _dqRos.w, _dqThree)

  child.quaternion.copy(calib.restQuat).multiply(_dqThree)

  if (isSwivelDebugEnabled()) {
    const now = performance.now()
    if (now - lastSwivelDebugAt >= SWIVEL_DEBUG_THROTTLE_MS) {
      lastSwivelDebugAt = now
      console.log('[TF→Three caster_swivel]', {
        name: child.name,
        parentFrame: edge.parentFrame,
        childFrame: edge.childFrame,
        tfRotationRos: {
          x: +r.x.toFixed(6),
          y: +r.y.toFixed(6),
          z: +r.z.toFixed(6),
          w: +r.w.toFixed(6),
        },
        deltaQuatThree: quatToLog(_dqThree),
        threeEulerDegAfter: eulerDegToLog(child),
      })
    }
  }
}

/**
 * glTF 里 caster_swivel 与 caster_wheel 常为兄弟；attach 一次后随父节点转向。
 */
function ensureCasterWheelHierarchy(animRoot: THREE.Object3D) {
  if (hierarchyBoundRoot === animRoot) return

  const swivels: THREE.Object3D[] = []
  const casterWheels: THREE.Object3D[] = []
  animRoot.traverse((obj) => {
    const name = obj.name?.toLowerCase() ?? ''
    if (/^caster_swivel_(left|right)$/.test(name)) swivels.push(obj)
    if (/^caster_wheel_(left|right)$/.test(name)) casterWheels.push(obj)
  })

  if (swivels.length > 0 && casterWheels.length > 0) {
    bindCasterWheelsToSwivels(swivels, casterWheels)
    if (process.env.NODE_ENV === 'development') {
      console.info('[TF→Three] caster_wheel attach 到 caster_swivel', {
        pairs: casterWheels.map((w) => `${w.name} → ${w.parent?.name}`),
      })
    }
  }

  hierarchyBoundRoot = animRoot
}

/**
 * 用 /tf 同步万向轮支架（caster_swivel_*）。
 * 轮子滚动由 odom twist Dead Reckoning 处理（见 wheel-spin.ts）。
 */
export function applyWheelJointsFromTf(animRoot: THREE.Object3D): boolean {
  if (!tfRuntimeStore.hasWheelData()) {
    if (isSwivelDebugEnabled() && !loggedMissingOnce) {
      loggedMissingOnce = true
      console.warn('[TF→Three] tfRuntimeStore 无轮子 TF 数据（decode 失败或尚未收到）')
    }
    return false
  }

  ensureCasterWheelHierarchy(animRoot)

  let applied = 0
  for (const childFrame of TF_WHEEL_CHILD_FRAMES) {
    const edge = tfRuntimeStore.getEdge(childFrame)
    if (!edge) continue

    const child = findObjectByTfFrame(animRoot, childFrame)
    if (!child) continue

    if (isCasterSwivelFrame(childFrame)) {
      applySwivelFromTf(child, edge)
      applied++
    }
  }

  return applied > 0
}

/** 断开 Simulate 时清除各关节校准缓存 */
export function resetTfJointCalibration(root: THREE.Object3D) {
  root.traverse((child) => {
    delete child.userData.tfJointCalib
  })
  loggedMissingOnce = false
  lastSwivelDebugAt = 0
  hierarchyBoundRoot = null
}
