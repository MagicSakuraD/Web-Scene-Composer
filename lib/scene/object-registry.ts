import * as THREE from 'three'

/** sceneNodeId → three.js object (prim root from glTF or actor group) */
export const objectByNodeId = new Map<string, THREE.Object3D>()

/** sceneNodeId → meshes to highlight when selected */
export const highlightMeshesByNodeId = new Map<string, THREE.Mesh[]>()

export function registerSceneObject(nodeId: string, obj: THREE.Object3D) {
  objectByNodeId.set(nodeId, obj)
}

export function unregisterSceneObject(nodeId: string) {
  objectByNodeId.delete(nodeId)
  highlightMeshesByNodeId.delete(nodeId)
}

export function collectHighlightMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  if (root instanceof THREE.Mesh || root instanceof THREE.SkinnedMesh) {
    meshes.push(root)
  }
  root.traverse((child) => {
    if (child !== root && (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh)) {
      meshes.push(child)
    }
  })
  return meshes
}

export function registerHighlightMeshes(nodeId: string, root: THREE.Object3D) {
  highlightMeshesByNodeId.set(nodeId, collectHighlightMeshes(root))
}

export function resolvePickedNodeId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    if (current.userData.ignorePick) {
      current = current.parent
      continue
    }
    if (typeof current.userData.sceneNodeId === 'string') {
      return current.userData.sceneNodeId
    }
    if (typeof current.userData.sceneRootId === 'string') {
      return current.userData.sceneRootId
    }
    current = current.parent
  }
  return null
}

const HIGHLIGHT_COLOR = new THREE.Color('#7d56f4')

export function applyMeshHighlight(mesh: THREE.Mesh, on: boolean) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const mat of materials) {
    if (!(mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial)) {
      continue
    }
    if (on) {
      if (mat.userData._savedEmissive === undefined) {
        mat.userData._savedEmissive = mat.emissive.clone()
        mat.userData._savedEmissiveIntensity = mat.emissiveIntensity
      }
      mat.emissive.copy(HIGHLIGHT_COLOR)
      mat.emissiveIntensity = 0.45
    } else if (mat.userData._savedEmissive) {
      mat.emissive.copy(mat.userData._savedEmissive)
      mat.emissiveIntensity = mat.userData._savedEmissiveIntensity ?? 1
    }
  }
}

export function clearAllHighlights() {
  for (const meshes of highlightMeshesByNodeId.values()) {
    for (const mesh of meshes) applyMeshHighlight(mesh, false)
  }
  for (const obj of objectByNodeId.values()) {
    if (obj instanceof THREE.Mesh) applyMeshHighlight(obj, false)
  }
}

export function applySelectionHighlight(_nodeId: string | null, _nodes: Record<string, { type: string }>) {
  clearAllHighlights()
}
