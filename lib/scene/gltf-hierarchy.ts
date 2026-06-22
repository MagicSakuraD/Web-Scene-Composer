import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { buildGltfSceneGraph } from './gltf-traverse'
import type { SceneNode } from './types'

const loader = new GLTFLoader()

export async function loadGltfSceneGraph(
  url: string,
  assetRootId: string,
): Promise<Record<string, SceneNode>> {
  const gltf = await loader.loadAsync(url)
  return buildGltfSceneGraph(assetRootId, gltf.scene)
}

export function removeGltfDescendants(
  nodes: Record<string, SceneNode>,
  assetRootId: string,
): Record<string, SceneNode> {
  const next = { ...nodes }
  for (const id of Object.keys(next)) {
    const node = next[id]
    if (node.assetRootId === assetRootId || id.startsWith(`${assetRootId}::`)) {
      delete next[id]
    }
  }
  return next
}

export {
  buildGltfSceneGraph,
  tagGltfSceneNodeIds,
  traverseGltfScene,
} from './gltf-traverse'
