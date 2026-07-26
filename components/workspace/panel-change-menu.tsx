'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ListTree,
  Radio,
  SlidersHorizontal,
  FileSearch,
  Search,
} from 'lucide-react'
import { useSetAtom } from 'jotai'
import { setSidePanelAtom } from '@/lib/workspace/atoms'
import {
  getSidePanelDef,
  SIDE_PANEL_TYPES,
} from '@/lib/workspace/side-panel-registry'
import type { SidePanelType, SideSlot } from '@/lib/workspace/types'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

const PANEL_ICONS: Record<SidePanelType, typeof ListTree> = {
  hierarchy: ListTree,
  topics: Radio,
  inspector: SlidersHorizontal,
  'frame-inspector': FileSearch,
}

interface PanelChangeMenuProps {
  slot: SideSlot
  currentType: SidePanelType
  open: boolean
  anchorRect: DOMRect | null
  onClose: () => void
}

export function PanelChangeMenu({
  slot,
  currentType,
  open,
  anchorRect,
  onClose,
}: PanelChangeMenuProps) {
  const { t } = useI18n()
  const setSidePanel = useSetAtom(setSidePanelAtom)
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onMouse = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouse)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onMouse)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return SIDE_PANEL_TYPES.filter((type) => {
      const def = getSidePanelDef(type)
      const name = t(def.nameKey).toLowerCase()
      const desc = t(def.descriptionKey).toLowerCase()
      return !q || name.includes(q) || desc.includes(q) || type.includes(q)
    })
  }, [query, t])

  if (!open || !anchorRect) return null

  const menuWidth = 280
  const left = Math.min(anchorRect.left, window.innerWidth - menuWidth - 8)
  const top = anchorRect.bottom + 4

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[200] w-[280px] rounded-md border border-border bg-popover shadow-lg overflow-hidden"
      style={{ top, left }}
    >
      <div className="px-2 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 rounded bg-input border border-border px-2 py-1">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={t('sidePanel.searchPanels')}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="mt-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('sidePanel.changePanel')}
        </p>
      </div>
      <ul className="max-h-64 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">{t('sidePanel.noResults')}</li>
        ) : (
          filtered.map((type) => {
            const def = getSidePanelDef(type)
            const Icon = PANEL_ICONS[type]
            const active = type === currentType
            return (
              <li key={type}>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-accent transition-colors',
                    active && 'bg-accent/80',
                  )}
                  onClick={() => {
                    setSidePanel({ slot, type })
                    onClose()
                  }}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-foreground">{t(def.nameKey)}</span>
                    <span className="block text-[10px] text-muted-foreground line-clamp-2">
                      {t(def.descriptionKey)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>,
    document.body,
  )
}

/** Hook to position menu from a button ref */
export function usePanelMenuAnchor() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    setAnchorRect(buttonRef.current.getBoundingClientRect())
  }, [open])

  return {
    buttonRef,
    open,
    setOpen,
    anchorRect,
    toggle: () => setOpen((v) => !v),
    close: () => setOpen(false),
  }
}
