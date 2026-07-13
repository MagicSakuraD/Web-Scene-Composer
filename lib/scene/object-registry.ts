import * as THREE from 'three'

/** sceneNodeId → three.js object (prim root from glTF or actor group) */
export const objectByNodeId = new Map<string, THREE.Object3D>()

/** sceneNodeId → meshes to highlight when selected */
export const highlightMeshesByNodeId = new Map<string, THREE.Mesh[]>()

/** Meshes that currently have an attached backface outline hull */
const meshesWithOutlineHull = new Set<THREE.Mesh>()

export const SELECTION_OUTLINE_COLOR = new THREE.Color('#ea580c')
const SELECTION_EMISSIVE_INTENSITY = 0.38
const OUTLINE_HULL_SCALE = 1.025

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
      mat.emissive.copy(SELECTION_OUTLINE_COLOR)
      mat.emissiveIntensity = SELECTION_EMISSIVE_INTENSITY
    } else if (mat.userData._savedEmissive) {
      mat.emissive.copy(mat.userData._savedEmissive)
      mat.emissiveIntensity = mat.userData._savedEmissiveIntensity ?? 1
      delete mat.userData._savedEmissive
      delete mat.userData._savedEmissiveIntensity
    }
  }
}

function findOutlineHull(mesh: THREE.Mesh): THREE.Mesh | null {
  for (const child of mesh.children) {
    if (child instanceof THREE.Mesh && child.userData.isSelectionOutline) {
      return child
    }
  }
  return null
}

/** WebGPU 兼容：BackSide 略放大 hull，模拟 Blender 外轮廓 */
export function attachOutlineHull(mesh: THREE.Mesh) {
  detachOutlineHull(mesh)
  if (!mesh.geometry) return

  const hull = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({
      color: SELECTION_OUTLINE_COLOR,
      side: THREE.BackSide,
      toneMapped: false,
      depthWrite: true,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    }),
  )
  hull.name = '__wsc_selection_outline__'
  hull.userData.isSelectionOutline = true
  hull.frustumCulled = mesh.frustumCulled
  hull.scale.setScalar(OUTLINE_HULL_SCALE)
  mesh.add(hull)
  meshesWithOutlineHull.add(mesh)
}

export function detachOutlineHull(mesh: THREE.Mesh) {
  const hull = findOutlineHull(mesh)
  if (!hull) return
  mesh.remove(hull)
  hull.material.dispose()
  meshesWithOutlineHull.delete(mesh)
}

export function clearAllOutlineHulls() {
  for (const mesh of meshesWithOutlineHull) {
    detachOutlineHull(mesh)
  }
}

export function clearAllHighlights() {
  for (const meshes of highlightMeshesByNodeId.values()) {
    for (const mesh of meshes) applyMeshHighlight(mesh, false)
  }
  for (const obj of objectByNodeId.values()) {
    if (obj instanceof THREE.Mesh) applyMeshHighlight(obj, false)
  }
  clearAllOutlineHulls()
}

/** 选中高亮：普通 Mesh 用 backface 轮廓，SkinnedMesh 用 emissive 回退 */
export function applySelectionHighlight(nodeId: string | null) {
  clearAllHighlights()
  if (!nodeId) return

  const meshes = highlightMeshesByNodeId.get(nodeId)
  if (!meshes?.length) return

  for (const mesh of meshes) {
    if (mesh instanceof THREE.SkinnedMesh) {
      applyMeshHighlight(mesh, true)
    } else {
      attachOutlineHull(mesh)
    }
  }
}
