'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { CREATE_MENU_SECTIONS } from '@/lib/scene/create-menu'
import { useAddSceneNode } from '@/lib/scene/use-add-scene-node'
import { cn } from '@/lib/utils'
import { GltfFileInput } from '@/components/gltf-file-input'

interface AddObjectMenuProps {
  className?: string
  children?: React.ReactNode
}

export function AddObjectMenu({ className, children }: AddObjectMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { handleCreateAction, fileInputRef, onFileInputChange } = useAddSceneNode()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const onAction = (action: Parameters<typeof handleCreateAction>[0]) => {
    handleCreateAction(action)
    setOpen(false)
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <GltfFileInput ref={fileInputRef} onChange={onFileInputChange} />
      {children ? (
        <div onClick={() => setOpen(!open)}>{children}</div>
      ) : (
        <button
          className="p-1.5 rounded hover:bg-accent text-toolbar-foreground"
          title="Create"
          onClick={() => setOpen(!open)}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-md border border-border bg-popover shadow-lg z-50 py-1">
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
                  onClick={() => onAction(action)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
