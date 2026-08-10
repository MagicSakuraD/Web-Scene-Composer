'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { btTimelineStore, type BtNodeCategory, type BtTimelineSegment } from '@/lib/ros/bt-timeline-store'
import { BT_LOG_TOPIC } from '@/lib/ros/nav-goal-config'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

const CATEGORY_COLORS: Record<BtNodeCategory, string> = {
  planning: 'bg-sky-500/80',
  control: 'bg-emerald-500/80',
  recovery: 'bg-amber-500/90',
  condition: 'bg-violet-500/60',
  other: 'bg-slate-500/70',
}

const STATUS_BORDER: Record<string, string> = {
  RUNNING: 'ring-1 ring-white/30',
  SUCCESS: 'opacity-90',
  FAILURE: 'ring-1 ring-red-400/80',
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function buildRows(segments: readonly BtTimelineSegment[]) {
  const byLabel = new Map<string, BtTimelineSegment[]>()
  for (const seg of segments) {
    const list = byLabel.get(seg.label) ?? []
    list.push(seg)
    byLabel.set(seg.label, list)
  }
  return Array.from(byLabel.entries())
    .map(([label, segs]) => ({
      label,
      category: segs[segs.length - 1]?.category ?? 'other',
      segments: segs,
    }))
    .slice(-12)
}

export function BehaviorTimeline({ className }: { className?: string }) {
  const { t } = useI18n()
  const snap = useSyncExternalStore(
    btTimelineStore.subscribe.bind(btTimelineStore),
    () => btTimelineStore.getSnapshot(),
    () => btTimelineStore.getSnapshot(),
  )
  const [, setTick] = useState(0)

  useEffect(() => {
    if (snap.activeNodes.length === 0) return
    const id = window.setInterval(() => setTick((n) => n + 1), 400)
    return () => window.clearInterval(id)
  }, [snap.activeNodes.length])

  const now = performance.now()
  const origin = snap.missionStartMs ?? now
  const span = Math.max(now - origin, 1200)
  const rows = useMemo(() => buildRows(snap.segments), [snap.segments])

  return (
    <section className={cn('rounded-md border border-border bg-muted/15 p-3 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">{t('navGoal.bt.section')}</h4>
        <span className="text-[10px] font-mono text-muted-foreground">
          {snap.subscribed ? BT_LOG_TOPIC : t('navGoal.bt.waitingTopic')}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
          {t('navGoal.bt.recoveryCount')}: {snap.recoveryCount}
        </span>
        {snap.activeNodes.length > 0 ? (
          snap.activeNodes.map((node) => (
            <span
              key={node}
              className="rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 font-mono"
            >
              {node}
            </span>
          ))
        ) : (
          <span className="text-muted-foreground">{t('navGoal.bt.noActive')}</span>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2 items-center">
              <span
                className="truncate text-[10px] font-mono text-muted-foreground"
                title={row.label}
              >
                {row.label}
              </span>
              <div className="relative h-3 rounded bg-background/60 overflow-hidden">
                {row.segments.map((seg) => {
                  const end = seg.endMs ?? now
                  const left = ((seg.startMs - origin) / span) * 100
                  const width = Math.max(((end - seg.startMs) / span) * 100, 0.8)
                  return (
                    <div
                      key={seg.id}
                      className={cn(
                        'absolute top-0 h-full rounded-sm',
                        CATEGORY_COLORS[row.category],
                        STATUS_BORDER[seg.status],
                      )}
                      style={{ left: `${Math.max(left, 0)}%`, width: `${width}%` }}
                      title={`${seg.label} · ${seg.status}`}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground">{t('navGoal.bt.empty')}</p>
      )}

      {snap.events.length > 0 && (
        <div className="rounded border border-border/60 bg-background/40 max-h-28 overflow-y-auto">
          <ul className="divide-y divide-border/40">
            {snap.events
              .slice()
              .reverse()
              .slice(0, 8)
              .map((evt) => (
                <li
                  key={evt.id}
                  className="px-2 py-1 text-[10px] font-mono flex items-center gap-2"
                >
                  <span className="text-muted-foreground shrink-0">
                    +{formatElapsed(evt.atMs - origin)}
                  </span>
                  <span className="truncate text-foreground">{evt.label}</span>
                  <span className="text-muted-foreground shrink-0">
                    {evt.previousStatus} → {evt.currentStatus}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground leading-relaxed">{t('navGoal.bt.hint')}</p>
    </section>
  )
}
