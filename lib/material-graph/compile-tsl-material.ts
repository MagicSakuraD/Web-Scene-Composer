import { MeshPhysicalNodeMaterial } from 'three/webgpu'
import { add, color, float, mix, mul, texture, uv } from 'three/tsl'
import type { MaterialGraph, MaterialGraphNode } from './types'
import { getMaterialGraphTexture } from './texture-cache'

/** 颜色/贴图混合链路的 TSL 节点 */
type ShaderColorNode = ReturnType<typeof color> | ReturnType<typeof texture>

function getInputNode(
  graph: MaterialGraph,
  nodeId: string,
  portId: string,
): MaterialGraphNode | null {
  const edge = graph.edges.find((e) => e.to.nodeId === nodeId && e.to.port === portId)
  if (!edge) return null
  return graph.nodes.find((n) => n.id === edge.from.nodeId) ?? null
}

function compileColorNode(node: MaterialGraphNode, graph: MaterialGraph): ShaderColorNode {
  switch (node.type) {
    case 'color':
      return color(String(node.data.hex ?? '#ffffff'))
    case 'texture': {
      const imageUrl = String(node.data.imageUrl ?? '')
      const loaded = imageUrl ? getMaterialGraphTexture(imageUrl) : null
      if (loaded) return texture(loaded, uv())
      return color(String(node.data.fallbackHex ?? '#cccccc'))
    }
    case 'uv':
      return color('#808080')
    case 'multiply': {
      const a = getInputNode(graph, node.id, 'a')
      const b = getInputNode(graph, node.id, 'b')
      if (a && b) return mul(compileColorNode(a, graph), compileColorNode(b, graph))
      if (a) return compileColorNode(a, graph)
      if (b) return compileColorNode(b, graph)
      return color('#ffffff')
    }
    case 'add': {
      const a = getInputNode(graph, node.id, 'a')
      const b = getInputNode(graph, node.id, 'b')
      if (a && b) return add(compileColorNode(a, graph), compileColorNode(b, graph))
      if (a) return compileColorNode(a, graph)
      if (b) return compileColorNode(b, graph)
      return color('#000000')
    }
    case 'mix': {
      const a = getInputNode(graph, node.id, 'a')
      const b = getInputNode(graph, node.id, 'b')
      const factorNode = getInputNode(graph, node.id, 'factor')
      const factor = factorNode
        ? compileFloatNode(factorNode, graph)
        : float(Number(node.data.factor ?? 0.5))
      if (a && b) return mix(compileColorNode(a, graph), compileColorNode(b, graph), factor)
      return color('#808080')
    }
    default:
      return color('#ffffff')
  }
}

function compileFloatNode(node: MaterialGraphNode, graph: MaterialGraph): ReturnType<typeof float> {
  if (node.type === 'float') return float(Number(node.data.value ?? 0.5))
  return float(0.5)
}

function resolveFloatInput(
  graph: MaterialGraph,
  principledId: string,
  portId: string,
  fallback: number,
): ReturnType<typeof float> {
  const input = getInputNode(graph, principledId, portId)
  if (input) return compileFloatNode(input, graph)
  return float(fallback)
}

function resolveColorInput(
  graph: MaterialGraph,
  principledId: string,
  portId: string,
  fallbackHex: string,
): ShaderColorNode {
  const input = getInputNode(graph, principledId, portId)
  if (input) return compileColorNode(input, graph)
  return color(fallbackHex)
}

/**
 * MaterialGraph → MeshPhysicalNodeMaterial（TSL）
 * 映射 MeshPhysicalNodeMaterial 常用 *Node 属性：
 * colorNode, roughnessNode, metalnessNode, emissiveNode, opacityNode,
 * normalNode, transmissionNode, clearcoatNode, iorNode
 */
export function compileMaterialGraph(graph: MaterialGraph): MeshPhysicalNodeMaterial {
  const principled = graph.nodes.find((n) => n.type === 'principled')
  const data = principled?.data ?? {}

  const roughness = resolveFloatInput(graph, principled?.id ?? '', 'roughness', Number(data.roughness ?? 0.5))
  const metalness = resolveFloatInput(graph, principled?.id ?? '', 'metalness', Number(data.metalness ?? 0))
  const transmission = resolveFloatInput(
    graph,
    principled?.id ?? '',
    'transmission',
    Number(data.transmission ?? 0),
  )
  const clearcoat = resolveFloatInput(graph, principled?.id ?? '', 'clearcoat', Number(data.clearcoat ?? 0))
  const ior = resolveFloatInput(graph, principled?.id ?? '', 'ior', Number(data.ior ?? 1.5))
  const opacity = resolveFloatInput(graph, principled?.id ?? '', 'opacity', 1)

  let baseColor = color('#ffffff')
  if (principled) {
    const baseInput = getInputNode(graph, principled.id, 'baseColor')
    if (baseInput) baseColor = compileColorNode(baseInput, graph)
  }

  const material = new MeshPhysicalNodeMaterial()
  material.colorNode = baseColor
  material.roughnessNode = roughness
  material.metalnessNode = metalness
  material.transmissionNode = transmission
  material.clearcoatNode = clearcoat
  material.iorNode = ior
  material.opacityNode = opacity

  if (principled) {
    const emissiveIn = getInputNode(graph, principled.id, 'emissive')
    if (emissiveIn) material.emissiveNode = compileColorNode(emissiveIn, graph)

    const normalIn = getInputNode(graph, principled.id, 'normal')
    if (normalIn) material.normalNode = compileColorNode(normalIn, graph)
  }

  return material
}
