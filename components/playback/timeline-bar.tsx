'use client'

import { useCallback, useMemo } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  appModeAtom,
  mcapFileNameAtom,
  playbackPlayingAtom,
  playbackRangeAtom,
  playbackRateAtom,
  playbackTimeNsAtom,
} from '@/lib/playback/atoms'
import { playbackEngine } from '@/lib/playback/playback-engine'
import { useI18n } from '@/hooks/use-i18n'

function formatTimeNs(ns: bigint): string {
  const totalSec = Number(ns) / 1e9
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`
}

const RATE_OPTIONS = [0.25, 0.5, 1, 2, 4]

export function TimelineBar() {
  const appMode = useAtomValue(appModeAtom)
  const range = useAtomValue(playbackRangeAtom)
  const [currentNs, setCurrentNs] = useAtom(playbackTimeNsAtom)
  const [playing, setPlaying] = useAtom(playbackPlayingAtom)
  const [rate, setRate] = useAtom(playbackRateAtom)
  const fileName = useAtomValue(mcapFileNameAtom)
  const { t } = useI18n()

  const atEnd = useMemo(() => {
    if (!range) return false
    return currentNs >= range.endNs
  }, [range, currentNs])

  const slider = useMemo(() => {
    if (!range) return { min: 0, max: 1, value: 0 }
    const min = Number(range.startNs) / 1e9
    const max = Number(range.endNs) / 1e9
    const value = Number(currentNs) / 1e9
    return { min, max, value: Math.min(max, Math.max(min, value)) }
  }, [range, currentNs])

  const onSeek = useCallback(
    (sec: number) => {
      const ns = BigInt(Math.round(sec * 1e9))
      setCurrentNs(ns)
      void playbackEngine.seek(ns)
    },
    [setCurrentNs],
  )

  const togglePlay = useCallback(() => {
    if (playing) {
      playbackEngine.pause()
      setPlaying(false)
      return
    }
    if (atEnd && range) {
      void playbackEngine.seek(range.startNs).then(() => {
        playbackEngine.play()
      })
      return
    }
    playbackEngine.play()
  }, [playing, setPlaying, atEnd, range])

  if (appMode !== 'playback' || !range) return null

  const showReplay = atEnd && !playing

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-toolbar/80 shrink-0">
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={t('playback.timeline.stepBack')}
          onClick={() => void playbackEngine.stepFrame(-100)}
        >
          <SkipBack className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={
            playing
              ? t('playback.timeline.pause')
              : showReplay
                ? t('playback.timeline.replay')
                : t('playback.timeline.play')
          }
          onClick={togglePlay}
        >
          {playing ? (
            <Pause className="h-3.5 w-3.5" />
          ) : showReplay ? (
            <RotateCcw className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          title={t('playback.timeline.stepForward')}
          onClick={() => void playbackEngine.stepFrame(100)}
        >
          <SkipForward className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Select
        value={String(rate)}
        onValueChange={(v) => {
          if (v) setRate(Number(v))
        }}
      >
        <SelectTrigger size="sm" className="h-7 w-[4.5rem] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATE_OPTIONS.map((r) => (
            <SelectItem key={r} value={String(r)}>
              {r}x
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1 min-w-0 px-1">
        <Slider
          min={slider.min}
          max={slider.max}
          step={0.01}
          value={[slider.value]}
          onValueChange={(vals) => {
            const sec = Array.isArray(vals) ? vals[0] : vals
            if (typeof sec === 'number') onSeek(sec)
          }}
        />
      </div>

      <span className="text-xs font-mono text-muted-foreground whitespace-nowrap tabular-nums">
        {formatTimeNs(currentNs)} / {formatTimeNs(range.endNs)}
      </span>

      {fileName && (
        <span className="text-xs text-muted-foreground truncate max-w-[140px] hidden sm:inline">
          {fileName}
        </span>
      )}
    </div>
  )
}
