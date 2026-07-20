import * as THREE from 'three'

/** sceneNodeId → three.js object (prim root from glTF or actor group) */
export const objectByNodeId = new Map<string, THREE.Object3D>()

/** sceneNodeId → meshes under node（材质图等复用） */
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
  const seen = new Set<THREE.Mesh>()

  const add = (mesh: THREE.Mesh) => {
    if (mesh.userData.isSelectionBox || seen.has(mesh)) return
    seen.add(mesh)
    meshes.push(mesh)
  }

  const visit = (obj: THREE.Object3D) => {
    if (obj.userData.isSelectionBox) return
    if (obj.userData.demotedFromMesh) return
    if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
      add(obj)
      return
    }
    for (const child of obj.children) visit(child)
  }

  visit(root)
  return meshes
}

export function registerHighlightMeshes(nodeId: string, root: THREE.Object3D) {
  highlightMeshesByNodeId.set(nodeId, collectHighlightMeshes(root))
}

/** 解析 sceneNodeId 对应的 Three 根（含 asset-ref → glTF clone） */
export function resolveRegisteredRoot(nodeId: string): THREE.Object3D | undefined {
  const direct = objectByNodeId.get(nodeId)
  if (direct) return direct
  for (const obj of objectByNodeId.values()) {
    if (obj.userData.sceneRootId === nodeId) return obj
  }
  return undefined
}

/**
 * 射线拾取 → 场景节点 id。
 * InstancedMesh 命中时用 intersection.instanceId 映射到被实例化前的 prim。
 */
export function resolvePickedNodeId(
  object: THREE.Object3D,
  instanceId?: number,
): string | null {
  if (
    object instanceof THREE.InstancedMesh &&
    instanceId != null &&
    instanceId >= 0
  ) {
    const ids = object.userData.instanceSceneNodeIds as Array<string | undefined> | undefined
    const sid = ids?.[instanceId]
    if (typeof sid === 'string') return sid

    const proxies = object.userData.instanceProxies as THREE.Object3D[] | undefined
    const proxy = proxies?.[instanceId]
    if (proxy && typeof proxy.userData.sceneNodeId === 'string') {
      return proxy.userData.sceneNodeId
    }
  }

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
