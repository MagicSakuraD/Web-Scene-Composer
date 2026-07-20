'use client'

import { useAtomValue } from 'jotai'
import {
  mcapFileNameAtom,
  mcapTopicsAtom,
  playbackRangeAtom,
  playbackTimeNsAtom,
  selectedTopicAtom,
} from '@/lib/playback/atoms'
import { useI18n } from '@/hooks/use-i18n'

function formatTimeNs(ns: bigint): string {
  const totalSec = Number(ns) / 1e9
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`
}

export function FrameInspector() {
  const { t } = useI18n()
  const fileName = useAtomValue(mcapFileNameAtom)
  const range = useAtomValue(playbackRangeAtom)
  const currentNs = useAtomValue(playbackTimeNsAtom)
  const selectedTopic = useAtomValue(selectedTopicAtom)
  const topics = useAtomValue(mcapTopicsAtom)

  const selected = topics.find((t) => t.topic === selectedTopic)

  return (
    <div className="h-full flex flex-col flex-1 min-w-0 bg-muted/20 text-sidebar-foreground overflow-hidden">
      <div className="px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('playback.inspector.title')}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">
            {t('playback.inspector.playback')}
          </h3>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('playback.inspector.file')}</dt>
              <dd className="font-mono truncate max-w-[60%] text-right">{fileName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('playback.inspector.current')}</dt>
              <dd className="font-mono">{formatTimeNs(currentNs)}</dd>
            </div>
            {range && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('playback.inspector.duration')}</dt>
                <dd className="font-mono">
                  {formatTimeNs(range.startNs)} – {formatTimeNs(range.endNs)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">{t('playback.inspector.topics')}</dt>
              <dd>{topics.length}</dd>
            </div>
          </dl>
        </section>

        {selected ? (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">
              {t('playback.inspector.topic')}
            </h3>
            <dl className="space-y-1.5 text-xs">
              <div>
                <dt className="text-muted-foreground mb-0.5">{t('playback.inspector.topicName')}</dt>
                <dd className="font-mono break-all">{selected.topic}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-0.5">{t('playback.inspector.schema')}</dt>
                <dd className="font-mono break-all">{selected.schemaName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('playback.inspector.channel')}</dt>
                <dd>{selected.channelId}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <p className="text-xs text-muted-foreground">{t('playback.inspector.selectTopic')}</p>
        )}
      </div>
    </div>
  )
}
