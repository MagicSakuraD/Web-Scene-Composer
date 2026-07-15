import type { MaterialGraphNodeType } from './types'

export interface NodeDefinition {
  type: MaterialGraphNodeType
  title: string
  category: 'input' | 'math' | 'shader' | 'output'
  /** 每图最大数量；undefined = 不限 */
  maxPerGraph?: number
  defaultData: Record<string, string | number | boolean>
  defaultSize?: { w: number; h: number }
}

/** 可添加到 Shader Graph 的节点（对应 Three.js TSL / MeshPhysicalNodeMaterial 常用项） */
export const NODE_DEFINITIONS: Record<MaterialGraphNodeType, NodeDefinition> = {
  color: {
    type: 'color',
    title: 'Color',
    category: 'input',
    defaultData: { hex: '#ffffff' },
  },
  texture: {
    type: 'texture',
    title: 'Image Texture',
    category: 'input',
    defaultData: { label: 'Albedo Map', fallbackHex: '#8a9a7a', imageUrl: '', fileName: '' },
  },
  float: {
    type: 'float',
    title: 'Value',
    category: 'input',
    defaultData: { value: 0.5, min: 0, max: 1 },
  },
  uv: {
    type: 'uv',
    title: 'Texture Coordinates',
    category: 'input',
    defaultData: { channel: 'uv0' },
  },
  multiply: {
    type: 'multiply',
    title: 'Multiply',
    category: 'math',
    defaultData: {},
  },
  add: {
    type: 'add',
    title: 'Add',
    category: 'math',
    defaultData: {},
  },
  mix: {
    type: 'mix',
    title: 'Mix',
    category: 'math',
    defaultData: { factor: 0.5 },
  },
  principled: {
    type: 'principled',
    title: 'Principled BSDF',
    category: 'shader',
    maxPerGraph: 1,
    defaultData: {
      roughness: 0.5,
      metalness: 0,
      transmission: 0,
      clearcoat: 0,
      ior: 1.5,
    },
  },
  output: {
    type: 'output',
    title: 'Outputs',
    category: 'output',
    maxPerGraph: 1,
    defaultData: {},
  },
}

export const ADDABLE_NODE_TYPES: MaterialGraphNodeType[] = [
  'color',
  'texture',
  'float',
  'uv',
  'multiply',
  'add',
  'mix',
  'principled',
  'output',
]

export function canAddNode(
  type: MaterialGraphNodeType,
  existingTypes: MaterialGraphNodeType[],
): boolean {
  const def = NODE_DEFINITIONS[type]
  if (!def.maxPerGraph) return true
  const count = existingTypes.filter((t) => t === type).length
  return count < def.maxPerGraph
}

export function createGraphNode(
  type: MaterialGraphNodeType,
  position: { x: number; y: number },
  extraData?: Record<string, string | number | boolean>,
) {
  const def = NODE_DEFINITIONS[type]
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title: def.title,
    position,
    data: { ...def.defaultData, ...extraData },
  }
}
