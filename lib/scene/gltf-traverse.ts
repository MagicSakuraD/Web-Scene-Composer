import * as THREE from 'three'
import type { GltfPrimKind, SceneNode, Transform } from './types'
import { DEFAULT_TRANSFORM } from './types'

export function getGltfPrimKind(obj: THREE.Object3D): GltfPrimKind {
  if (obj instanceof THREE.SkinnedMesh) return 'SkinnedMesh'
  if (obj instanceof THREE.Mesh) return 'Mesh'
  if (obj instanceof THREE.Bone) return 'Bone'
  if (obj instanceof THREE.Light) return 'Light'
  if (obj instanceof THREE.Camera) return 'Camera'
  if (obj instanceof THREE.Group) return 'Xform'
  return 'Object3D'
}

function displayName(obj: THREE.Object3D, kind: GltfPrimKind, index: number): string {
  if (obj.name) return obj.name
  return `${kind}_${index}`
}

export function shouldIncludeInHierarchy(obj: THREE.Object3D): boolean {
  if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) return true
  if (obj instanceof THREE.Bone) return true
  if (obj instanceof THREE.Light) return true
  if (obj.name) return true
  return obj.children.length > 0
}

export interface GltfTraverseContext {
  obj: THREE.Object3D
  nodeId: string
  path: string
  kind: GltfPrimKind
  parentId: string
}

/** Shared walk — same paths for outliner nodes and viewport object tags */
export function traverseGltfScene(
  scene: THREE.Object3D,
  assetRootId: string,
  visitor: (ctx: GltfTraverseContext) => void,
) {
  let counter = 0

  function walk(obj: THREE.Object3D, parentId: string, parentPath: string) {
    if (!shouldIncludeInHierarchy(obj)) {
      obj.children.forEach((child) => walk(child, parentId, parentPath))
      return
    }

    counter += 1
    const kind = getGltfPrimKind(obj)
    const label = displayName(obj, kind, counter)
    const path = parentPath ? `${parentPath}/${label}` : label
    const nodeId = `${assetRootId}::${path}`

    visitor({ obj, nodeId, path, kind, parentId })

    obj.children.forEach((child) => walk(child, nodeId, path))
  }

  scene.children.forEach((child) => walk(child, assetRootId, ''))
}

export function extractLocalTransform(obj: THREE.Object3D): Transform {
  return {
    position: [obj.position.x, obj.position.y, obj.position.z],
    rotation: [
      THREE.MathUtils.radToDeg(obj.rotation.x),
      THREE.MathUtils.radToDeg(obj.rotation.y),
      THREE.MathUtils.radToDeg(obj.rotation.z),
    ],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
  }
}

export function buildGltfSceneGraph(
  rootNodeId: string,
  scene: THREE.Object3D,
): Record<string, SceneNode> {
  const nodes: Record<string, SceneNode> = {}

  traverseGltfScene(scene, rootNodeId, ({ obj, nodeId, path, kind, parentId }) => {
    nodes[nodeId] = {
      id: nodeId,
      name: obj.name || path.split('/').pop() || kind,
      type: 'gltf-prim',
      gltfKind: kind,
      gltfPath: path,
      assetRootId: rootNodeId,
      parentId,
      transform: extractLocalTransform(obj),
    }
  })

  return nodes
}

/** Tag three.js objects so raycast picks map back to outliner node ids */
export function tagGltfSceneNodeIds(scene: THREE.Object3D, assetRootId: string) {
  traverseGltfScene(scene, assetRootId, ({ obj, nodeId }) => {
    obj.userData.sceneNodeId = nodeId
    obj.userData.assetRootId = assetRootId
  })
}

export { DEFAULT_TRANSFORM }
