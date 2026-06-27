import type { SceneNode, NodeType } from './types'
import { DEFAULT_TRANSFORM } from './types'
import { removeGltfDescendants } from './gltf-hierarchy'
import { VIEWPORT_PHYSICAL_LIGHT_ID } from '@/lib/viewport/physical-light-node'

let nodeCounter = 0

function nextId(prefix: string) {
  nodeCounter += 1
  return `${prefix}-${nodeCounter}`
}

const NODE_NAMES: Record<NodeType, string> = {
  group: 'Group',
  ground: 'Ground Plane',
  cube: 'Cube',
  sphere: 'Sphere',
  'distant-light': 'Distant Light',
  'point-light': 'Point Light',
  'asset-ref': 'Asset',
}

const NODE_DEFAULTS: Partial<Record<NodeType, Partial<SceneNode>>> = {
  ground: {
    transform: DEFAULT_TRANSFORM,
  },
  cube: {
    transform: {
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },
  sphere: {
    transform: {
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
  },
  'distant-light': {
    transform: {
      position: [5, 8, 5],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    lightIntensity: 1.5,
    lightColor: '#ffffff',
  },
  'point-light': {
    transform: {
      position: [2, 3, 2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    lightIntensity: 2,
    lightColor: '#fff5e6',
  },
}

export function createNode(type: NodeType, parentId = 'root'): SceneNode {
  const id = nextId(type)
  const defaults = NODE_DEFAULTS[type] ?? {}

  return {
    id,
    name: NODE_NAMES[type],
    type,
    transform: defaults.transform ?? DEFAULT_TRANSFORM,
    parentId,
    lightIntensity: defaults.lightIntensity,
    lightColor: defaults.lightColor,
    assetUrl: defaults.assetUrl,
  }
}

export function addNodeToScene(
  nodes: Record<string, SceneNode>,
  type: NodeType,
  parentId = 'root',
): { nodes: Record<string, SceneNode>; newNode: SceneNode } {
  const newNode = createNode(type, parentId)
  return {
    nodes: { ...nodes, [newNode.id]: newNode },
    newNode,
  }
}

export function addAssetNodeToScene(
  nodes: Record<string, SceneNode>,
  assetUrl: string,
  name: string,
  parentId = 'root',
): { nodes: Record<string, SceneNode>; newNode: SceneNode } {
  const id = nextId('asset-ref')
  const newNode: SceneNode = {
    id,
    name: name.replace(/\.(glb|gltf)$/i, ''),
    type: 'asset-ref',
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    parentId,
    assetUrl,
  }
  return {
    nodes: { ...nodes, [newNode.id]: newNode },
    newNode,
  }
}

function collectSubtreeIds(nodes: Record<string, SceneNode>, rootId: string): Set<string> {
  const ids = new Set<string>()
  const stack = [rootId]
  while (stack.length > 0) {
    const id = stack.pop()!
    ids.add(id)
    for (const node of Object.values(nodes)) {
      if (node.parentId === id) stack.push(node.id)
    }
  }
  return ids
}

/** 删除节点及其子树；asset-ref 会一并移除 glTF 内部层级。不可删除 root。 */
export function removeNodeFromScene(
  nodes: Record<string, SceneNode>,
  nodeId: string,
): Record<string, SceneNode> | null {
  if (nodeId === 'root') return null
  if (nodeId === VIEWPORT_PHYSICAL_LIGHT_ID) return null
  const node = nodes[nodeId]
  if (!node) return null

  if (node.type === 'asset-ref') {
    const next = removeGltfDescendants({ ...nodes }, nodeId)
    delete next[nodeId]
    return next
  }

  const next = { ...nodes }
  for (const id of collectSubtreeIds(next, nodeId)) {
    delete next[id]
  }
  return next
}
