import * as THREE from 'three'
import { collectHighlightMeshes } from '@/lib/scene/object-registry'

export function applyNodeMaterialToObject(root: THREE.Object3D, material: THREE.Material) {
  const meshes = collectHighlightMeshes(root)
  for (const mesh of meshes) {
    const prev = mesh.material
    if (Array.isArray(prev)) {
      mesh.material = prev.map(() => material.clone())
    } else {
      mesh.material = material.clone()
    }
    mesh.material.needsUpdate = true
  }
}
