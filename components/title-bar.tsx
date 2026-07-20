'use client'

import { useRef } from 'react'
import {
  PanelLeft,
  PanelRight,
  Play,
  Square,
  Grid3x3,
  Sun,
  ChevronRight,
  FileVideo,
  Loader2,
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
import { useOpenMcap } from '@/hooks/use-open-mcap'
import { useI18n } from '@/hooks/use-i18n'
import {
  viewportDefaultLightsVisibleAtom,
  viewportGridVisibleAtom,
} from '@/lib/viewport/atoms'
import {
  appModeAtom,
  dataSourceModeAtom,
  mcapFileNameAtom,
  mcapLoadErrorAtom,
  mcapLoadingAtom,
  playbackPlayingAtom,
} from '@/lib/playback/atoms'
import { Button } from '@/components/ui/button'
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
  const { openFile } = useOpenMcap()
  const { t } = useI18n()
  const [appMode, setAppMode] = useAtom(appModeAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const mcapFileName = useAtomValue(mcapFileNameAtom)
  const mcapLoading = useAtomValue(mcapLoadingAtom)
  const mcapError = useAtomValue(mcapLoadErrorAtom)
  const playing = useAtomValue(playbackPlayingAtom)
  const [gridVisible, setGridVisible] = useAtom(viewportGridVisibleAtom)
  const [lightsVisible, setLightsVisible] = useAtom(viewportDefaultLightsVisibleAtom)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusLabel =
    dataSourceMode === 'replay'
      ? playing
        ? t('titleBar.status.playing')
        : t('titleBar.status.replayReady')
      : status === 'connecting'
        ? t('titleBar.status.connecting')
        : status === 'connected'
          ? t('titleBar.status.connected')
          : status === 'error'
            ? t('titleBar.status.error')
            : t('titleBar.status.ready')

  const statusColor =
    dataSourceMode === 'replay'
      ? 'text-sky-500'
      : status === 'connected'
        ? 'text-green-600 dark:text-green-400'
        : status === 'error'
          ? 'text-red-500'
          : status === 'connecting'
            ? 'text-amber-500'
            : 'text-green-600 dark:text-green-400'

  const onPickMcap = () => fileInputRef.current?.click()

  return (
    <div className="flex items-center h-11 px-2 bg-toolbar text-toolbar-foreground border-b border-border select-none">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mcap"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void openFile(file)
          e.target.value = ''
        }}
      />

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
        <div className="ml-2 flex items-center rounded-md border border-border overflow-hidden text-[10px]">
          <button
            className={cn(
              'px-2 py-0.5 transition-colors',
              appMode === 'compose'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
            onClick={() => setAppMode('compose')}
          >
            {t('titleBar.mode.compose')}
          </button>
          <button
            className={cn(
              'px-2 py-0.5 transition-colors border-l border-border',
              appMode === 'playback'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50',
            )}
            onClick={() => setAppMode('playback')}
          >
            {t('titleBar.mode.playback')}
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
        {appMode === 'compose' ? (
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
        ) : (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1.5"
            disabled={mcapLoading}
            onClick={onPickMcap}
          >
            {mcapLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileVideo className="h-3.5 w-3.5" />
            )}
            {mcapFileName ? t('titleBar.openMcapAnother') : t('titleBar.openMcap')}
          </Button>
        )}

        <div className="flex items-center gap-0.5 text-xs text-muted-foreground min-w-0">
          {breadcrumb.map((segment, i) => (
            <span key={segment} className="flex items-center gap-0.5">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={cn('truncate', i === breadcrumb.length - 1 ? 'text-foreground' : '')}>
                {segment}
              </span>
            </span>
          ))}
        </div>

        <span
          className={cn('text-xs font-medium truncate max-w-[200px]', statusColor)}
          title={mcapError ?? error ?? undefined}
        >
          {statusLabel}
          {mcapFileName ? ` · ${mcapFileName}` : ''}
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
        {appMode === 'compose' && <AddObjectMenu />}
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
