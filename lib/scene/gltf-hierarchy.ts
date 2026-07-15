import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { buildGltfSceneGraph } from './gltf-traverse'
import type { SceneNode } from './types'

/** 与 drei useGLTF 同源 CDN decoder；避免 Draco 压缩 GLB 报 No DRACOLoader */
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')

const loader = new GLTFLoader()
loader.setDRACOLoader(dracoLoader)

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
