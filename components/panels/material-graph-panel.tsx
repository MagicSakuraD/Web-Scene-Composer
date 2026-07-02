'use client'

import { useCallback } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Layers, Plus } from 'lucide-react'
import { selectedNodeAtom } from '@/lib/scene/atoms'
import { activeMaterialGraphAtom, createMaterialGraphAtom } from '@/lib/material-graph/atoms'
import { createEmptyGraph } from '@/lib/material-graph/graph-factory'
import { getMeshMaterialSummary } from '@/lib/material-graph/read-mesh-material'
import { MaterialGraphFlow } from '@/components/panels/material-graph/material-graph-flow'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

export function MaterialGraphPanel() {
  const { t } = useI18n()
  const selectedNode = useAtomValue(selectedNodeAtom)
  const [graph, setGraph] = useAtom(activeMaterialGraphAtom)
  const createGraph = useSetAtom(createMaterialGraphAtom)

  const materialSummary = selectedNode ? getMeshMaterialSummary(selectedNode.id) : null

  const onNodeDataChange = useCallback(
    (nodeId: string, patch: Record<string, string | number | boolean>) => {
      setGraph((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }))
    },
    [setGraph],
  )

  const onGraphChange = useCallback(
    (next: NonNullable<typeof graph>) => {
      setGraph(next)
    },
    [setGraph],
  )

  const handleCreateGraph = () => {
    if (!selectedNode) return
    createGraph(createEmptyGraph(selectedNode.id, selectedNode.name))
  }

  if (!selectedNode) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center bg-[var(--shader-graph-canvas-bg)]">
        <p className="text-xs text-muted-foreground">{t('materialGraph.selectMesh')}</p>
      </div>
    )
  }

  if (!graph) {
    return (
      <div className="h-full flex flex-col min-h-0 bg-[var(--shader-graph-canvas-bg)]">
        <div
          className="flex items-center gap-2 px-3 py-2 border-b border-[var(--shader-graph-node-border)] shrink-0"
          style={{ background: 'var(--shader-graph-toolbar-bg)' }}
        >
          <Layers className="h-3.5 w-3.5 text-[var(--shader-graph-accent-blue)]" />
          <span className="text-xs font-medium truncate">{selectedNode.name}</span>
          <span className="text-muted-foreground/50">›</span>
          <span className="text-xs truncate">{t('materialGraph.title')}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-xs text-muted-foreground max-w-sm">{t('materialGraph.noGraph')}</p>
          {materialSummary && (
            <p className="text-[10px] text-muted-foreground/80 max-w-sm">
              {t('materialGraph.existingMaterial', { type: materialSummary.materialType })}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70 max-w-sm">{t('materialGraph.cannotImport')}</p>
          <button
            type="button"
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs mt-1',
              'bg-[var(--shader-graph-accent-purple)] hover:opacity-90 text-white',
            )}
            onClick={handleCreateGraph}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('materialGraph.createGraph')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <MaterialGraphFlow
        key={selectedNode.id}
        graphKey={selectedNode.id}
        graph={graph}
        onGraphChange={onGraphChange}
        onNodeDataChange={onNodeDataChange}
      />

      <p className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-[var(--shader-graph-node-border)] leading-relaxed shrink-0 bg-[var(--shader-graph-toolbar-bg)]">
        {t('materialGraph.hint')}
      </p>
    </div>
  )
}
