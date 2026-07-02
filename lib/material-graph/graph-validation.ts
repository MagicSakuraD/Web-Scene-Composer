import type { MaterialGraph } from './types'

/** Outputs「Custom Surface」已连线时可编译并应用到 mesh（Blender / Isaac Sim 习惯） */
export function isMaterialGraphAppliable(graph: MaterialGraph): boolean {
  const output = graph.nodes.find((n) => n.type === 'output')
  if (!output) return false
  return graph.edges.some((e) => e.to.nodeId === output.id && e.to.port === 'surface')
}
