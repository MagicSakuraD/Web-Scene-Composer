import * as THREE from 'three'

/** 将 odom 世界位姿写入 Object3D（换算为 local，不修改 scale） */
export function applyWorldPose(
  obj: THREE.Object3D,
  worldPosition: THREE.Vector3,
  worldQuaternion: THREE.Quaternion,
) {
  if (obj.parent) {
    obj.parent.updateMatrixWorld(true)
    const parentPos = new THREE.Vector3()
    const parentQuat = new THREE.Quaternion()
    obj.parent.matrixWorld.decompose(parentPos, parentQuat, new THREE.Vector3())

    const invParentQuat = parentQuat.clone().invert()
    obj.quaternion.copy(invParentQuat).multiply(worldQuaternion)
    obj.position.copy(worldPosition.clone().sub(parentPos).applyQuaternion(invParentQuat))
  } else {
    obj.position.copy(worldPosition)
    obj.quaternion.copy(worldQuaternion)
  }
  obj.updateMatrix()
}
