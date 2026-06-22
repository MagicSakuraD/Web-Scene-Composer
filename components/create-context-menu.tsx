'use client'

import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { contextMenuAtom } from '@/lib/scene/atoms'
import { CREATE_MENU_SECTIONS } from '@/lib/scene/create-menu'
import { useAddSceneNode } from '@/lib/scene/use-add-scene-node'
import { GltfFileInput } from '@/components/gltf-file-input'

export function CreateContextMenu() {
  const [menu, setMenu] = useAtom(contextMenuAtom)
  const menuRef = useRef<HTMLDivElement>(null)
  const { handleCreateAction, fileInputRef, onFileInputChange } = useAddSceneNode()

  useEffect(() => {
    if (!menu) return

    const close = (e?: Event) => {
      if (e && menuRef.current?.contains(e.target as Node)) return
      setMenu(null)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }

    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menu, setMenu])

  if (!menu) return <GltfFileInput ref={fileInputRef} onChange={onFileInputChange} />

  const handleAction = (action: Parameters<typeof handleCreateAction>[0]) => {
    handleCreateAction(action)
    setMenu(null)
  }

  return (
    <>
      <GltfFileInput ref={fileInputRef} onChange={onFileInputChange} />
      <div
        ref={menuRef}
        className="fixed z-[100] min-w-[200px] rounded-md border border-border bg-popover shadow-lg py-1"
        style={{ left: menu.x, top: menu.y }}
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
          Create
        </div>
        {CREATE_MENU_SECTIONS.map((section) => (
          <div key={section.id}>
            <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {section.label}
            </div>
            {section.items.map(({ id, label, icon: Icon, action }) => (
              <button
                key={id}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent text-left"
                onClick={() => handleAction(action)}
              >
                <Icon className="h-4 w-4 text-muted-foreground" />
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

export function openCreateContextMenu(
  e: React.MouseEvent,
  target: 'viewport' | 'hierarchy',
  setMenu: (value: { x: number; y: number; target: 'viewport' | 'hierarchy' } | null) => void,
) {
  e.preventDefault()
  e.stopPropagation()
  setMenu({ x: e.clientX, y: e.clientY, target })
}
