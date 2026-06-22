'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAtom, useSetAtom } from 'jotai'
import { Plus } from 'lucide-react'
import {
  bottomPanelTabsAtom,
  activeBottomTabIdAtom,
  ADDABLE_PANELS,
  type BottomPanelTabType,
} from '@/lib/ros/atoms'
import { cn } from '@/lib/utils'

export function AddPanelMenu() {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [tabs, setTabs] = useAtom(bottomPanelTabsAtom)
  const setActive = useSetAtom(activeBottomTabIdAtom)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = 224
    setMenuPos({
      top: rect.top - 4,
      left: Math.max(8, rect.right - menuWidth),
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const addComponent = (type: BottomPanelTabType, name: string) => {
    if (tabs.some((t) => t.type === type)) {
      const existing = tabs.find((t) => t.type === type)
      if (existing) setActive(existing.id)
      setOpen(false)
      return
    }
    const id = `${type}-${Date.now()}`
    setTabs([...tabs, { id, type, name }])
    setActive(id)
    setOpen(false)
  }

  const menu =
    open &&
    createPortal(
      <div
        ref={menuRef}
        className="fixed z-[200] w-56 rounded-md border border-border bg-popover shadow-lg py-1"
        style={{ top: menuPos.top, left: menuPos.left, transform: 'translateY(-100%)' }}
      >
        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
          添加组件
        </div>
        {ADDABLE_PANELS.map((panel) => {
          const exists = tabs.some((t) => t.type === panel.type)
          return (
            <button
              key={panel.type}
              className={cn('w-full text-left px-3 py-2 hover:bg-accent', exists && 'opacity-60')}
              onClick={() => addComponent(panel.type, panel.name)}
            >
              <p className="text-sm">{panel.name}</p>
              <p className="text-[10px] text-muted-foreground">{panel.description}</p>
            </button>
          )
        })}
      </div>,
      document.body,
    )

  return (
    <>
      <button
        ref={buttonRef}
        className="p-1.5 rounded hover:bg-accent text-muted-foreground flex-shrink-0"
        title="添加组件"
        onClick={() => setOpen(!open)}
      >
        <Plus className="h-4 w-4" />
      </button>
      {menu}
    </>
  )
}
