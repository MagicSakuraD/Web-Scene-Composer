import * as THREE from 'three'

/** 选中包围框线色：oklch(64.6% 0.222 41.116) ≈ #f54900 */
export const SELECTION_BOX_COLOR = 0xf54900

const _size = new THREE.Vector3()

/**
 * 计算选中物体的世界空间 AABB（长宽高）。
 * auto-instance proxy 用 InstancedMesh 几何 + proxy 世界矩阵。
 */
export function computeSelectionBox3(target: THREE.Object3D, out: THREE.Box3): THREE.Box3 {
  out.makeEmpty()

  if (target.userData.demotedFromMesh && target.userData.autoInstancedMesh) {
    const instanced = target.userData.autoInstancedMesh as THREE.InstancedMesh
    const geom = instanced.geometry
    if (!geom.boundingBox) geom.computeBoundingBox()
    const local = geom.boundingBox
    if (!local || local.isEmpty()) return out
    target.updateMatrixWorld(true)
    return out.copy(local).applyMatrix4(target.matrixWorld)
  }

  return out.setFromObject(target, true)
}

/** 世界空间尺寸 (width, height, depth) */
export function getSelectionBoxSize(box: THREE.Box3): THREE.Vector3 {
  return box.getSize(_size)
}
