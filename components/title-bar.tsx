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

const GITHUB_REPO_URL = 'https://github.com/MagicSakuraD/Web-Scene-Composer'

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

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
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          title={t('titleBar.github')}
          aria-label={t('titleBar.github')}
        >
          <GitHubIcon className="h-4 w-4" />
        </a>
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
