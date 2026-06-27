'use client'

import { MousePointer2, Move, RotateCw, Maximize2, Globe, Box } from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import { transformModeAtom, spaceModeAtom } from '@/lib/scene/atoms'
import type { TransformMode } from '@/lib/scene/types'
import { cn } from '@/lib/utils'

const tools: { mode: TransformMode; icon: typeof Move; title: string }[] = [
  { mode: 'select', icon: MousePointer2, title: '选择（显示移动 Gizmo）' },
  { mode: 'translate', icon: Move, title: '移动' },
  { mode: 'rotate', icon: RotateCw, title: '旋转' },
  { mode: 'scale', icon: Maximize2, title: '缩放' },
]

export function ViewportToolbar() {
  const [mode, setMode] = useAtom(transformModeAtom)
  const [space, setSpace] = useAtom(spaceModeAtom)

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-md z-10">
      <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
        {tools.map(({ mode: toolMode, icon: Icon, title }) => (
          <button
            key={toolMode}
            className={cn(
              'p-1.5 rounded transition-colors',
              mode === toolMode
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title={title}
            onClick={() => setMode(toolMode)}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-0.5" />

      <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            space === 'world'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
          title="世界空间"
          onClick={() => setSpace('world')}
        >
          <Globe className="h-3.5 w-3.5" />
          World
        </button>
        <button
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            space === 'local'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
          title="本地空间"
          onClick={() => setSpace('local')}
        >
          <Box className="h-3.5 w-3.5" />
          Local
        </button>
      </div>
    </div>
  )
}
