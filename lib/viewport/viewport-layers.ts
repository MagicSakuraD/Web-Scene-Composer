import type * as THREE from 'three'

/** Default R3F/Three layer — raycaster hits this. */
export const VIEWPORT_LAYER_PICK = 0
/** LiDAR / LaserScan Points — skip CPU raycast (100k points). */
export const VIEWPORT_LAYER_SENSOR = 1

const _noopRaycast: THREE.Object3D['raycast'] = () => {}

/**
 * Skip CPU raycast on dense Points. Keep default layer 0 so the camera still draws them
 * (`layers.set(sensor)` would hide the object).
 */
export function disableSensorRaycast(object: THREE.Object3D) {
  object.layers.enable(VIEWPORT_LAYER_PICK)
  object.raycast = _noopRaycast
}
