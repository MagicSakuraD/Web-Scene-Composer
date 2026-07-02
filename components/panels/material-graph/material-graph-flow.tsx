'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
} from '@xyflow/react'
import { Layers, Search } from 'lucide-react'
import type { MaterialGraph } from '@/lib/material-graph/types'
import { PROTECTED_NODE_TYPES, type MaterialGraphNodeType } from '@/lib/material-graph/types'
import {
  materialGraphToFlow,
  syncGraphFromFlow,
  type ShaderFlowEdge,
  type ShaderFlowNode,
} from '@/lib/material-graph/flow-adapters'
import { MaterialGraphFlowContext } from './flow-context'
import { shaderNodeTypes } from './shader-nodes'
import { AddNodeMenu } from './add-node-menu'
import { useI18n } from '@/hooks/use-i18n'

interface MaterialGraphFlowProps {
  graph: MaterialGraph
  graphKey: string
  onGraphChange: (graph: MaterialGraph) => void
  onNodeDataChange: (nodeId: string, patch: Record<string, string | number | boolean>) => void
}

function deferParentUpdate(fn: () => void) {
  queueMicrotask(fn)
}

export function MaterialGraphFlow({
  graph,
  graphKey,
  onGraphChange,
  onNodeDataChange,
}: MaterialGraphFlowProps) {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const colorMode = resolvedTheme === 'dark' ? 'dark' : 'light'
  const isDark = colorMode === 'dark'
  const [search, setSearch] = useState('')

  const graphRef = useRef(graph)
  graphRef.current = graph

  const initial = useMemo(() => materialGraphToFlow(graph), [graphKey])
  const [nodes, setNodes, onNodesChange] = useNodesState<ShaderFlowNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<ShaderFlowEdge>(initial.edges)

  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges

  const searchLower = search.trim().toLowerCase()
  const displayNodes = useMemo(() => {
    if (!searchLower) return nodes
    return nodes.map((n) => {
      const title = String(n.data.title ?? '').toLowerCase()
      const match = title.includes(searchLower) || n.type.includes(searchLower)
      return { ...n, style: { ...n.style, opacity: match ? 1 : 0.35 } }
    })
  }, [nodes, searchLower])

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = materialGraphToFlow(graph)
    setNodes(nextNodes)
    setEdges(nextEdges)
  }, [graphKey, setNodes, setEdges])

  const syncGraphDeferred = useCallback(
    (nextNodes: ShaderFlowNode[], nextEdges: ShaderFlowEdge[]) => {
      deferParentUpdate(() => {
        onGraphChange(syncGraphFromFlow(graphRef.current, nextNodes, nextEdges))
      })
    },
    [onGraphChange],
  )

  const handleNodeDataChange = useCallback(
    (nodeId: string, patch: Record<string, string | number | boolean>) => {
      const nextNodes = nodesRef.current.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
      )
      setNodes(nextNodes)
      deferParentUpdate(() => onNodeDataChange(nodeId, patch))
    },
    [setNodes, onNodeDataChange],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      const nextEdges = addEdge(
        {
          ...connection,
          id: `e-${connection.source}-${connection.target}-${Date.now()}`,
          type: 'default',
        },
        edgesRef.current,
      )
      setEdges(nextEdges)
      syncGraphDeferred(nodesRef.current, nextEdges)
    },
    [setEdges, syncGraphDeferred],
  )

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: ShaderFlowNode) => {
      const nextNodes = nodesRef.current.map((n) =>
        n.id === node.id ? { ...n, position: node.position } : n,
      )
      setNodes(nextNodes)
      syncGraphDeferred(nextNodes, edgesRef.current)
    },
    [setNodes, syncGraphDeferred],
  )

  const onEdgesDelete = useCallback(
    (deleted: ShaderFlowEdge[]) => {
      const deletedIds = new Set(deleted.map((e) => e.id))
      const nextEdges = edgesRef.current.filter((e) => !deletedIds.has(e.id))
      setEdges(nextEdges)
      syncGraphDeferred(nodesRef.current, nextEdges)
    },
    [setEdges, syncGraphDeferred],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      const deletedIds = new Set(deleted.map((n) => n.id))
      const nextNodes = nodesRef.current.filter((n) => !deletedIds.has(n.id))
      const nextEdges = edgesRef.current.filter(
        (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
      )
      setNodes(nextNodes)
      setEdges(nextEdges)
      syncGraphDeferred(nextNodes, nextEdges)
    },
    [setNodes, setEdges, syncGraphDeferred],
  )

  const onBeforeDelete = useCallback(
    async ({ nodes: toDelete, edges: edgesToDelete }: { nodes: Node[]; edges: ShaderFlowEdge[] }) => ({
      nodes: toDelete.filter(
        (n) => !PROTECTED_NODE_TYPES.includes(n.type as MaterialGraphNodeType),
      ),
      edges: edgesToDelete,
    }),
    [],
  )

  const handleAddNodes = useCallback(
    (added: ShaderFlowNode[]) => {
      const nextNodes = [...nodesRef.current, ...added]
      setNodes(nextNodes)
      syncGraphDeferred(nextNodes, edgesRef.current)
    },
    [setNodes, syncGraphDeferred],
  )

  const existingTypes = nodes.map((n) => n.type as MaterialGraphNodeType)

  const contextValue = useMemo(
    () => ({ onNodeDataChange: handleNodeDataChange }),
    [handleNodeDataChange],
  )

  const dotColor = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.28)'
  const minimapMask = isDark ? 'rgba(30,32,40,0.82)' : 'rgba(245,245,245,0.82)'

  return (
    <MaterialGraphFlowContext.Provider value={contextValue}>
      <div className="shader-graph-flow flex-1 min-h-[320px] min-w-0 h-full">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
          onBeforeDelete={onBeforeDelete}
          nodeTypes={shaderNodeTypes}
          colorMode={colorMode}
          fitView={nodes.length > 0}
          fitViewOptions={{ padding: 0.28 }}
          deleteKeyCode={['Backspace', 'Delete']}
          defaultEdgeOptions={{ type: 'default' }}
          className="shader-graph-canvas"
          proOptions={{ hideAttribution: true }}
        >
          <Panel
            position="top-left"
            className="!m-0 !p-0 w-full nodrag nopan nowheel pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-[var(--shader-graph-node-border)] pointer-events-auto"
              style={{ background: 'var(--shader-graph-toolbar-bg)' }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-blue)]" />
                <span className="text-xs font-medium truncate">{graph.name}</span>
                <span className="text-muted-foreground/50">›</span>
                <span className="text-xs text-muted-foreground truncate">{t('materialGraph.title')}</span>
              </div>
              <div className="flex-1" />
              <div className="relative w-40 max-w-[40%] shrink-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  placeholder={t('materialGraph.search')}
                  className="w-full h-7 pl-7 pr-2 text-[11px] rounded-md border border-[var(--shader-graph-node-border)] bg-[var(--shader-graph-input-bg)] outline-none focus:ring-1 focus:ring-[var(--shader-graph-accent-blue)]"
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <AddNodeMenu
                existingTypes={existingTypes}
                meshName={graph.name}
                onNodesChange={handleAddNodes}
              />
            </div>
          </Panel>

          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color={dotColor} />
          <Controls showInteractive={false} position="bottom-left" className="!m-3" />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => {
              if (n.type === 'output') return '#3b82f6'
              if (n.type === 'multiply' || n.type === 'add' || n.type === 'mix') return '#64748b'
              return '#a855f7'
            }}
            maskColor={minimapMask}
            className="shader-graph-minimap !m-3 !border !border-[var(--shader-graph-node-border)] !rounded-lg"
          />
        </ReactFlow>
      </div>
    </MaterialGraphFlowContext.Provider>
  )
}
