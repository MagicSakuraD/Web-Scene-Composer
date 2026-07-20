'use client'

import { MousePointer2, Move, RotateCw, Maximize2, Globe, Box } from 'lucide-react'
import { useAtom } from 'jotai'
import { transformModeAtom, spaceModeAtom } from '@/lib/scene/atoms'
import { viewportShadingAtom, type ViewportShading } from '@/lib/viewport/atoms'
import type { TransformMode } from '@/lib/scene/types'
import type { MessageKey } from '@/lib/i18n/messages'
import { useI18n } from '@/hooks/use-i18n'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const tools: { mode: TransformMode; icon: typeof Move; titleKey: MessageKey }[] = [
  { mode: 'select', icon: MousePointer2, titleKey: 'viewport.tool.select' },
  { mode: 'translate', icon: Move, titleKey: 'viewport.tool.translate' },
  { mode: 'rotate', icon: RotateCw, titleKey: 'viewport.tool.rotate' },
  { mode: 'scale', icon: Maximize2, titleKey: 'viewport.tool.scale' },
]

const shadingOptions: { value: ViewportShading; labelKey: MessageKey }[] = [
  { value: 'shaded', labelKey: 'viewport.shading.shaded' },
  { value: 'solid', labelKey: 'viewport.shading.solid' },
  { value: 'wireframe', labelKey: 'viewport.shading.wireframe' },
  { value: 'normals', labelKey: 'viewport.shading.normals' },
]

export function ViewportToolbar() {
  const { t } = useI18n()
  const [mode, setMode] = useAtom(transformModeAtom)
  const [space, setSpace] = useAtom(spaceModeAtom)
  const [shading, setShading] = useAtom(viewportShadingAtom)

  const shadingItems = shadingOptions.map(({ value, labelKey }) => ({
    value,
    label: t(labelKey),
  }))

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-card/90 backdrop-blur-sm border border-border p-1 shadow-md z-10">
      <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
        {tools.map(({ mode: toolMode, icon: Icon, titleKey }) => (
          <button
            key={toolMode}
            type="button"
            className={cn(
              'p-1.5 rounded transition-colors',
              mode === toolMode
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
            title={t(titleKey)}
            aria-label={t(titleKey)}
            onClick={() => setMode(toolMode)}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-border mx-0.5" />

      <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            space === 'world'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
          title={t('viewport.space.world')}
          onClick={() => setSpace('world')}
        >
          <Globe className="h-3.5 w-3.5" />
          World
        </button>
        <button
          type="button"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors',
            space === 'local'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent',
          )}
          title={t('viewport.space.local')}
          onClick={() => setSpace('local')}
        >
          <Box className="h-3.5 w-3.5" />
          Local
        </button>
      </div>

      <div className="w-px h-5 bg-border mx-0.5" />

      <Select
        value={shading}
        onValueChange={(value) => {
          if (value != null) setShading(value as ViewportShading)
        }}
        items={shadingItems}
      >
        <SelectTrigger
          size="sm"
          className="h-7 min-w-[6.5rem] border-0 bg-accent/40 shadow-none dark:bg-accent/40 dark:hover:bg-accent/60"
          aria-label={t('viewport.shading.title')}
          title={t('viewport.shading.title')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent side="top" align="center" className="z-[100]">
          {shadingOptions.map(({ value, labelKey }) => (
            <SelectItem key={value} value={value}>
              {t(labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
