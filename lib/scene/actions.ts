import type { SceneNode, NodeType } from './types'
import { DEFAULT_TRANSFORM, ROBOT_ASSET_URL } from './types'

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
  'asset-ref': 'Robot',
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
  'asset-ref': {
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    assetUrl: ROBOT_ASSET_URL,
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
