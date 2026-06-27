import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

const _box = new THREE.Box3()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _dir = new THREE.Vector3()

/** 将 OrbitControls 相机聚焦到目标 Object3D */
export function frameObject(
  object: THREE.Object3D,
  camera: THREE.Camera,
  controls: OrbitControlsImpl,
  padding = 1.5,
) {
  _box.setFromObject(object)
  if (_box.isEmpty()) {
    _box.set(object.position.clone(), object.position.clone().add(new THREE.Vector3(0.5, 0.5, 0.5)))
  }

  _box.getCenter(_center)
  _box.getSize(_size)
  const maxDim = Math.max(_size.x, _size.y, _size.z, 0.5)

  const perspective = camera as THREE.PerspectiveCamera
  const fov = THREE.MathUtils.degToRad(perspective.fov ?? 50)
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * padding

  _dir.copy(camera.position).sub(controls.target)
  if (_dir.lengthSq() < 1e-6) _dir.set(1, 0.8, 1)
  _dir.normalize().multiplyScalar(distance)

  controls.target.copy(_center)
  camera.position.copy(_center).add(_dir)
  controls.update()
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

/** RMB 飞行：WASD / 方向键 / QE / PageUp·Down */
export const FLY_KEY_BINDINGS: Record<string, THREE.Vector3 | null> = {
  KeyW: new THREE.Vector3(0, 0, -1),
  ArrowUp: new THREE.Vector3(0, 0, -1),
  KeyS: new THREE.Vector3(0, 0, 1),
  ArrowDown: new THREE.Vector3(0, 0, 1),
  KeyA: new THREE.Vector3(-1, 0, 0),
  ArrowLeft: new THREE.Vector3(-1, 0, 0),
  KeyD: new THREE.Vector3(1, 0, 0),
  ArrowRight: new THREE.Vector3(1, 0, 0),
  KeyQ: new THREE.Vector3(0, -1, 0),
  PageUp: new THREE.Vector3(0, -1, 0),
  KeyE: new THREE.Vector3(0, 1, 0),
  PageDown: new THREE.Vector3(0, 1, 0),
}

export const FLY_SPEED = 10

/** 根据按键集合计算相机空间移动向量 */
export function computeFlyDelta(
  keys: Set<string>,
  camera: THREE.Camera,
  delta: number,
  speed = FLY_SPEED,
): THREE.Vector3 | null {
  const move = new THREE.Vector3()
  for (const key of keys) {
    const binding = FLY_KEY_BINDINGS[key]
    if (binding) move.add(binding)
  }
  if (move.lengthSq() < 1e-6) return null

  move.normalize().multiplyScalar(speed * delta)

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  forward.y = 0
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1)
  forward.normalize()

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
  const up = new THREE.Vector3(0, 1, 0)

  const world = new THREE.Vector3()
  world.addScaledVector(forward, -move.z)
  world.addScaledVector(right, move.x)
  world.addScaledVector(up, -move.y)

  return world
}

export function applyFlyDelta(
  delta: THREE.Vector3,
  camera: THREE.Camera,
  controls: OrbitControlsImpl,
) {
  camera.position.add(delta)
  controls.target.add(delta)
  controls.update()
}
