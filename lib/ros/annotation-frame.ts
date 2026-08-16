import * as THREE from 'three'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'

const _qT = new THREE.Quaternion()
const _qLocal = new THREE.Quaternion()
const _p = new THREE.Vector3()

export function applyRosPose(
  T: RosTransform,
  position: [number, number, number],
  orientation: [number, number, number, number],
): { position: [number, number, number]; orientation: [number, number, number, number] } {
  const qT = new THREE.Quaternion(
    T.rotation.x,
    T.rotation.y,
    T.rotation.z,
    T.rotation.w,
  )
  const p = new THREE.Vector3(position[0], position[1], position[2]).applyQuaternion(qT)
  p.x += T.translation.x
  p.y += T.translation.y
  p.z += T.translation.z
  const q = qT
    .clone()
    .multiply(
      new THREE.Quaternion(orientation[0], orientation[1], orientation[2], orientation[3]),
    )
  return {
    position: [p.x, p.y, p.z],
    orientation: [q.x, q.y, q.z, q.w],
  }
}

/** Pose in sourceFrame → pose in displayFrame (ROS). */
export function poseToDisplayFrame(
  sourceFrame: string,
  displayFrame: string,
  position: [number, number, number],
  orientation: [number, number, number, number],
): { position: [number, number, number]; orientation: [number, number, number, number] } {
  const src = sourceFrame || 'map'
  const dst = displayFrame || src
  if (!dst || src === dst) return { position, orientation }
  const T = tfRuntimeStore.lookupTransform(dst, src)
  if (!T) return { position, orientation }
  return applyRosPose(T, position, orientation)
}

/** Pose in displayFrame → pose in storageFrame (ROS). */
export function poseFromDisplayFrame(
  storageFrame: string,
  displayFrame: string,
  position: [number, number, number],
  orientation: [number, number, number, number],
): { position: [number, number, number]; orientation: [number, number, number, number] } {
  const storage = storageFrame || 'map'
  const display = displayFrame || storage
  if (!display || storage === display) return { position, orientation }
  const T = tfRuntimeStore.lookupTransform(storage, display)
  if (!T) return { position, orientation }
  return applyRosPose(T, position, orientation)
}

/**
 * Write source-frame pose into `object` in display-frame (ROS).
 * Reuses scratch quaternions/vectors — safe in useFrame.
 */
export function applyDisplayPoseToObject(
  sourceFrame: string,
  displayFrame: string,
  position: [number, number, number],
  orientation: [number, number, number, number],
  object: THREE.Object3D,
) {
  const src = sourceFrame || 'map'
  const dst = displayFrame || src
  _qLocal.set(orientation[0], orientation[1], orientation[2], orientation[3])
  _p.set(position[0], position[1], position[2])
  if (dst && src !== dst) {
    const T = tfRuntimeStore.lookupTransform(dst, src)
    if (T) {
      _qT.set(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
      _p.applyQuaternion(_qT)
      _p.x += T.translation.x
      _p.y += T.translation.y
      _p.z += T.translation.z
      object.position.copy(_p)
      object.quaternion.copy(_qT).multiply(_qLocal)
      return
    }
  }
  object.position.copy(_p)
  object.quaternion.copy(_qLocal)
}
