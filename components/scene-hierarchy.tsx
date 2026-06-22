'use client'

import { ChevronRight, ChevronDown, Plus, Search } from 'lucide-react'
import { useEffect } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  composedStageAtom,
  sceneNodesAtom,
  selectedNodeIdAtom,
  hierarchySearchAtom,
  expandedNodesAtom,
  contextMenuAtom,
} from '@/lib/scene/atoms'
import type { SceneTreeNode } from '@/lib/scene/types'
import { getNodeIcon, getGltfKindLabel } from '@/lib/scene/node-icons'
import { AddObjectMenu } from '@/components/add-object-menu'
import { openCreateContextMenu } from '@/components/create-context-menu'
import { cn } from '@/lib/utils'

interface TreeItemProps {
  node: SceneTreeNode
  level: number
  search: string
}

function TreeItem({ node, level, search }: TreeItemProps) {
  const [expanded, setExpanded] = useAtom(expandedNodesAtom)
  const [selectedId, setSelectedId] = useAtom(selectedNodeIdAtom)
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const isSelected = selectedId === node.id

  const matchesSearch =
    !search ||
    node.name.toLowerCase().includes(search.toLowerCase()) ||
    (node.gltfPath?.toLowerCase().includes(search.toLowerCase()) ?? false)

  const childMatches = node.children.some((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.gltfPath?.toLowerCase().includes(q) ?? false) ||
      c.children.length > 0
    )
  })

  if (search && !matchesSearch && !childMatches) return null

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-1 rounded cursor-pointer text-sm select-none transition-colors min-w-0',
          isSelected
            ? 'bg-selection-accent text-white'
            : 'hover:bg-accent/50 text-foreground/90',
        )}
        style={{ paddingLeft: `${level * 14 + 4}px` }}
        onClick={() => setSelectedId(node.id)}
      >
        {hasChildren ? (
          <button
            className="p-0 hover:bg-transparent flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(node.id)) next.delete(node.id)
                else next.add(node.id)
                return next
              })
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 opacity-70" />
            ) : (
              <ChevronRight className="h-3 w-3 opacity-70" />
            )}
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">{getNodeIcon(node)}</span>
        <span className="truncate flex-1">{node.name}</span>
        {node.gltfKind && (
          <span
            className={cn(
              'text-[9px] px-1 py-0 rounded flex-shrink-0 uppercase tracking-wide',
              isSelected ? 'bg-white/20 text-white/90' : 'bg-muted text-muted-foreground',
            )}
          >
            {getGltfKindLabel(node.gltfKind)}
          </span>
        )}
      </div>
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeItem key={child.id} node={child} level={level + 1} search={search} />
        ))}
    </div>
  )
}

export function SceneHierarchy() {
  const tree = useAtomValue(composedStageAtom)
  const nodes = useAtomValue(sceneNodesAtom)
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const [search, setSearch] = useAtom(hierarchySearchAtom)
  const setExpanded = useSetAtom(expandedNodesAtom)
  const setContextMenu = useSetAtom(contextMenuAtom)

  const root = tree[0]
  const isEmpty = !root || (root.children.length === 0 && tree.length <= 1)

  useEffect(() => {
    if (!selectedId) return
    setExpanded((prev) => {
      const next = new Set(prev)
      next.add('root')
      let cur = nodes[selectedId]
      while (cur) {
        next.add(cur.id)
        cur = cur.parentId ? nodes[cur.parentId] : undefined
      }
      return next
    })
  }, [selectedId, nodes, setExpanded])

  return (
    <div className="h-full flex flex-col bg-sidebar flex-1 min-w-0">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <div className="inline-flex items-center px-3 py-1 bg-selection-accent/15 rounded text-xs font-medium text-selection-accent">
          Scene
        </div>
      </div>

      <div
        className="flex-1 overflow-auto p-1"
        onContextMenu={(e) => openCreateContextMenu(e, 'hierarchy', setContextMenu)}
      >
        {tree.map((node) => (
          <TreeItem key={node.id} node={node} level={0} search={search} />
        ))}
        {isEmpty && (
          <p className="px-3 py-2 text-[10px] text-muted-foreground/80 leading-relaxed">
            No prims under Root. Right-click to Create, or import a .glb to expand its internal hierarchy.
          </p>
        )}
      </div>

      <div className="border-t border-border p-2 flex items-center gap-1">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded bg-input border border-border">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="Filter prims"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <AddObjectMenu>
          <button
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
            title="Create"
          >
            <Plus className="h-4 w-4" />
          </button>
        </AddObjectMenu>
      </div>
    </div>
  )
}
