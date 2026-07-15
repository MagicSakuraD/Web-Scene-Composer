import type { MaterialGraph, MaterialGraphNode } from './types'

function stripEphemeralTextureUrls(nodes: MaterialGraphNode[]): MaterialGraphNode[] {
  return nodes.map((n) => {
    if (n.type !== 'texture') return n
    const url = n.data.imageUrl
      if (typeof url === 'string' && url.startsWith('blob:')) {
        return {
          ...n,
          data: {
            ...n.data,
            imageUrl: '',
            fileName: '',
          },
        }
      }
    return n
  })
}

/** 导出前清理：blob: 贴图 URL 刷新后无效，需用户重新上传 */
export function sanitizeMaterialGraphForExport(graph: MaterialGraph): MaterialGraph {
  return {
    ...graph,
    nodes: stripEphemeralTextureUrls(graph.nodes),
  }
}

export function downloadMaterialGraphJson(graph: MaterialGraph, filename?: string) {
  const payload = sanitizeMaterialGraphForExport(graph)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `${payload.name.replace(/[^\w.-]+/g, '_') || 'material-graph'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function isMaterialGraph(value: unknown): value is MaterialGraph {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    Array.isArray(g.nodes) &&
    Array.isArray(g.edges)
  )
}

/** 解析导入的 JSON；保留当前图的 id / name（绑定到选中 mesh） */
export function parseImportedMaterialGraph(
  jsonText: string,
  bindTo: { id: string; name: string },
): MaterialGraph {
  const parsed: unknown = JSON.parse(jsonText)
  if (!isMaterialGraph(parsed)) {
    throw new Error('Invalid material graph JSON')
  }
  return {
    ...parsed,
    id: bindTo.id,
    name: bindTo.name,
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
  }
}
