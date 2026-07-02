import type { MaterialGraph } from './types'
import { createGraphNode } from './node-catalog'

/** 空白 Shader Graph（用户手动添加节点） */
export function createEmptyGraph(nodeId: string, meshName: string): MaterialGraph {
  return {
    id: `mat-${nodeId}`,
    name: meshName,
    nodes: [],
    edges: [],
  }
}

/** 最小 Shader Graph（Principled → Output） */
export function createGraphForMesh(nodeId: string, meshName: string): MaterialGraph {
  const principled = createGraphNode('principled', { x: 320, y: 100 })
  const output = createGraphNode('output', { x: 640, y: 120 }, { subtitle: meshName })

  return {
    id: `mat-${nodeId}`,
    name: `${meshName}`,
    nodes: [principled, output],
    edges: [
      {
        id: `e-${principled.id}-${output.id}`,
        from: { nodeId: principled.id, port: 'surface' },
        to: { nodeId: output.id, port: 'surface' },
      },
    ],
  }
}

/** 带示例节点的完整模板（地板练习用） */
export function createStarterGraph(nodeId: string, meshName: string): MaterialGraph {
  const tex = createGraphNode('texture', { x: 40, y: 60 })
  const tint = createGraphNode('color', { x: 40, y: 220 }, { hex: '#c8d4bc' })
  const mul = createGraphNode('multiply', { x: 300, y: 140 })
  const principled = createGraphNode('principled', { x: 520, y: 100 }, { roughness: 0.88, metalness: 0.04 })
  const output = createGraphNode('output', { x: 780, y: 120 }, { subtitle: meshName })

  return {
    id: `mat-${nodeId}`,
    name: meshName,
    nodes: [tex, tint, mul, principled, output],
    edges: [
      { id: 'e1', from: { nodeId: tex.id, port: 'colorOut' }, to: { nodeId: mul.id, port: 'a' } },
      { id: 'e2', from: { nodeId: tint.id, port: 'colorOut' }, to: { nodeId: mul.id, port: 'b' } },
      { id: 'e3', from: { nodeId: mul.id, port: 'out' }, to: { nodeId: principled.id, port: 'baseColor' } },
      { id: 'e4', from: { nodeId: principled.id, port: 'surface' }, to: { nodeId: output.id, port: 'surface' } },
    ],
  }
}
