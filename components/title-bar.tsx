'use client'

import {
  PanelLeft,
  PanelRight,
  Play,
  Square,
  Grid3x3,
  Sun,
  ChevronRight,
} from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import { ThemeToggle } from '@/components/theme-toggle'
import { LocaleToggle } from '@/components/locale-toggle'
import { InteractionHelpButton } from '@/components/interaction-help'
import { AddObjectMenu } from '@/components/add-object-menu'
import { breadcrumbAtom } from '@/lib/scene/atoms'
import { FOXGLOVE_WS_URL } from '@/lib/ros/atoms'
import { PROJECT_NAME } from '@/lib/scene/create-menu'
import { useSimulate } from '@/hooks/use-simulate'
import { useI18n } from '@/hooks/use-i18n'
import {
  viewportDefaultLightsVisibleAtom,
  viewportGridVisibleAtom,
} from '@/lib/viewport/atoms'
import { cn } from '@/lib/utils'

interface TitleBarProps {
  onToggleLeft: () => void
  onToggleRight: () => void
  leftOpen: boolean
  rightOpen: boolean
}

export function TitleBar({
  onToggleLeft,
  onToggleRight,
  leftOpen,
  rightOpen,
}: TitleBarProps) {
  const breadcrumb = useAtomValue(breadcrumbAtom)
  const { status, error, toggleSimulate, isActive } = useSimulate()
  const { t } = useI18n()
  const [gridVisible, setGridVisible] = useAtom(viewportGridVisibleAtom)
  const [lightsVisible, setLightsVisible] = useAtom(viewportDefaultLightsVisibleAtom)

  const statusLabel =
    status === 'connecting'
      ? t('titleBar.status.connecting')
      : status === 'connected'
        ? t('titleBar.status.connected')
        : status === 'error'
          ? t('titleBar.status.error')
          : t('titleBar.status.ready')

  const statusColor =
    status === 'connected'
      ? 'text-green-600 dark:text-green-400'
      : status === 'error'
        ? 'text-red-500'
        : status === 'connecting'
          ? 'text-amber-500'
          : 'text-green-600 dark:text-green-400'

  return (
    <div className="flex items-center h-11 px-2 bg-toolbar text-toolbar-foreground border-b border-border select-none">
      <div className="flex items-center gap-1 ml-2">
        <button
          className={cn(
            'p-1.5 rounded hover:bg-accent transition-colors',
            leftOpen ? 'text-foreground' : 'text-muted-foreground',
          )}
          title={t('titleBar.toggleLeft')}
          onClick={onToggleLeft}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <span className="ml-1 text-sm font-semibold text-foreground">{PROJECT_NAME}</span>
        <span className="ml-2 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-accent/60">
          {isActive ? t('titleBar.simulating') : t('titleBar.edited')}
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center gap-3">
        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-opacity',
            isActive
              ? 'bg-destructive text-destructive-foreground hover:opacity-90'
              : 'bg-primary text-primary-foreground hover:opacity-90',
          )}
          title={
            isActive
              ? t('titleBar.disconnectHint')
              : t('titleBar.connectHint', { url: FOXGLOVE_WS_URL })
          }
          onClick={() => void toggleSimulate()}
        >
          {isActive ? (
            <>
              <Square className="h-3.5 w-3.5 fill-current" />
              {t('titleBar.stop')}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              {t('titleBar.simulate')}
            </>
          )}
        </button>

        <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
          {breadcrumb.map((segment, i) => (
            <span key={segment} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={i === breadcrumb.length - 1 ? 'text-foreground' : ''}>
                {segment}
              </span>
            </span>
          ))}
        </div>

        <span className={cn('text-xs font-medium', statusColor)} title={error ?? undefined}>
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-0.5 mr-2">
        <button
          className={cn(
            'p-1.5 rounded hover:bg-accent transition-colors',
            gridVisible ? 'text-foreground bg-accent/60' : 'text-muted-foreground',
          )}
          title={gridVisible ? t('titleBar.gridOn') : t('titleBar.gridOff')}
          aria-pressed={gridVisible}
          onClick={() => setGridVisible((v) => !v)}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>
        <button
          className={cn(
            'p-1.5 rounded hover:bg-accent transition-colors',
            lightsVisible ? 'text-foreground bg-accent/60' : 'text-muted-foreground',
          )}
          title={lightsVisible ? t('titleBar.lightingOn') : t('titleBar.lightingOff')}
          aria-pressed={lightsVisible}
          onClick={() => setLightsVisible((v) => !v)}
        >
          <Sun className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <AddObjectMenu />
        <InteractionHelpButton />
        <LocaleToggle />
        <ThemeToggle />
        <button
          className={cn(
            'p-1.5 rounded hover:bg-accent transition-colors',
            rightOpen ? 'text-foreground' : 'text-muted-foreground',
          )}
          title={t('titleBar.toggleRight')}
          onClick={onToggleRight}
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
