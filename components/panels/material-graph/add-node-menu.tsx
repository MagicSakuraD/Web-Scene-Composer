'use client'

import { useCallback, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useReactFlow } from '@xyflow/react'
import { Plus } from 'lucide-react'
import type { MaterialGraphNodeType } from '@/lib/material-graph/types'
import {
  ADDABLE_NODE_TYPES,
  NODE_DEFINITIONS,
  canAddNode,
  createGraphNode,
} from '@/lib/material-graph/node-catalog'
import { materialGraphToFlow } from '@/lib/material-graph/flow-adapters'
import type { ShaderFlowNode } from '@/lib/material-graph/flow-adapters'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

interface AddNodeMenuProps {
  existingTypes: MaterialGraphNodeType[]
  meshName: string
  onNodesChange: (nextNodes: ShaderFlowNode[]) => void
}

function stopFlowPointer(e: React.PointerEvent | React.MouseEvent) {
  e.stopPropagation()
}

export function AddNodeMenu({ existingTypes, meshName, onNodesChange }: AddNodeMenuProps) {
  const { t } = useI18n()
  const { screenToFlowPosition } = useReactFlow()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.right - 200 })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mouseup', close)
    return () => document.removeEventListener('mouseup', close)
  }, [open])

  const addNode = useCallback(
    (type: MaterialGraphNodeType) => {
      if (!canAddNode(type, existingTypes)) return
      const anchor = buttonRef.current?.getBoundingClientRect()
      const flowPos = screenToFlowPosition({
        x: anchor ? anchor.left + anchor.width / 2 : window.innerWidth / 2,
        y: anchor ? anchor.bottom + 48 : window.innerHeight / 2,
      })
      const extra = type === 'output' ? { subtitle: meshName } : undefined
      const gn = createGraphNode(type, { x: flowPos.x - 80, y: flowPos.y - 40 }, extra)
      const fn = materialGraphToFlow({
        id: '',
        name: '',
        nodes: [gn],
        edges: [],
      }).nodes[0]
      onNodesChange([fn])
      setOpen(false)
    },
    [existingTypes, meshName, onNodesChange, screenToFlowPosition],
  )

  const categories = [
    { key: 'input' as const, types: ADDABLE_NODE_TYPES.filter((t) => NODE_DEFINITIONS[t].category === 'input') },
    { key: 'math' as const, types: ADDABLE_NODE_TYPES.filter((t) => NODE_DEFINITIONS[t].category === 'math') },
    { key: 'shader' as const, types: ADDABLE_NODE_TYPES.filter((t) => NODE_DEFINITIONS[t].category === 'shader') },
    { key: 'output' as const, types: ADDABLE_NODE_TYPES.filter((t) => NODE_DEFINITIONS[t].category === 'output') },
  ]

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[300] w-52 rounded-md border border-border bg-popover shadow-lg py-1 max-h-72 overflow-y-auto nodrag nopan nowheel"
        style={{ top: menuPos.top, left: menuPos.left }}
        onPointerDown={stopFlowPointer}
        onMouseDown={stopFlowPointer}
      >
        {categories.map((cat) =>
          cat.types.length === 0 ? null : (
            <div key={cat.key}>
              <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t(`materialGraph.category.${cat.key}`)}
              </p>
              {cat.types.map((type) => {
                const def = NODE_DEFINITIONS[type]
                const disabled = !canAddNode(type, existingTypes)
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={disabled}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs hover:bg-accent',
                      disabled && 'opacity-40 cursor-not-allowed',
                    )}
                    onPointerDown={stopFlowPointer}
                    onClick={(e) => {
                      e.stopPropagation()
                      addNode(type)
                    }}
                  >
                    {def.title}
                  </button>
                )
              })}
            </div>
          ),
        )}
      </div>,
      document.body,
    )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="nodrag nopan nowheel flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border border-[var(--shader-graph-node-border)] bg-[var(--shader-graph-toolbar-bg)] hover:bg-[var(--shader-graph-input-bg)] text-foreground shrink-0"
        onPointerDown={stopFlowPointer}
        onMouseDown={stopFlowPointer}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        <Plus className="h-3 w-3" />
        {t('materialGraph.newNode')}
      </button>
      {menu}
    </>
  )
}
