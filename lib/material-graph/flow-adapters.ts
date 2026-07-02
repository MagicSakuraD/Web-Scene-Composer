import type { Edge, Node } from '@xyflow/react'
import type { MaterialGraph, MaterialGraphNode, MaterialGraphNodeType } from './types'

export type ShaderFlowNodeData = {
  title: string
  nodeType: MaterialGraphNodeType
  [key: string]: string | number | boolean | MaterialGraphNodeType
}

export type ShaderFlowNode = Node<ShaderFlowNodeData, MaterialGraphNodeType>
export type ShaderFlowEdge = Edge

export function materialGraphToFlow(graph: MaterialGraph): {
  nodes: ShaderFlowNode[]
  edges: ShaderFlowEdge[]
} {
  const nodes: ShaderFlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: { ...n.position },
    data: { title: n.title, nodeType: n.type, ...n.data },
  }))

  const edges: ShaderFlowEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.from.nodeId,
    sourceHandle: e.from.port,
    target: e.to.nodeId,
    targetHandle: e.to.port,
    type: 'smoothstep',
  }))

  return { nodes, edges }
}

/** 从 React Flow 状态重建完整 MaterialGraph（支持动态增删节点） */
export function syncGraphFromFlow(
  graph: MaterialGraph,
  nodes: ShaderFlowNode[],
  edges: ShaderFlowEdge[],
): MaterialGraph {
  const flowNodes: MaterialGraphNode[] = nodes.map((fn) => {
    const { title, nodeType, ...rest } = fn.data
    void nodeType
    return {
      id: fn.id,
      type: fn.type as MaterialGraphNodeType,
      title: String(title ?? fn.type),
      position: { x: fn.position.x, y: fn.position.y },
      data: rest as Record<string, string | number | boolean>,
    }
  })

  return {
    ...graph,
    name: graph.name,
    nodes: flowNodes,
    edges: edges.map((e) => ({
      id: e.id,
      from: { nodeId: e.source, port: e.sourceHandle ?? 'out' },
      to: { nodeId: e.target, port: e.targetHandle ?? 'in' },
    })),
  }
}
