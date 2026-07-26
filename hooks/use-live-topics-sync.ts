'use client'

import { useEffect } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'

/**
 * Live Foxglove Bridge → shared Topics list (same atom as MCAP).
 * When not live, leaves MCAP topics alone.
 */
export function useLiveTopicsSync() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const setTopics = useSetAtom(mcapTopicsAtom)
  const setVisibility = useSetAtom(topicVisibilityAtom)

  useEffect(() => {
    if (dataSourceMode !== 'live') return

    const sync = () => {
      const infos = [...foxgloveManager.getTopicInfos()]
      setTopics(infos)
      setVisibility((prev) => {
        const next = { ...prev }
        for (const t of infos) {
          if (!(t.topic in next)) next[t.topic] = false
        }
        return next
      })
    }

    sync()
    const unsub = foxgloveManager.onChannelsChanged(sync)
    return () => {
      unsub()
    }
  }, [dataSourceMode, setTopics, setVisibility])

  // Leaving live → idle: clear shared list (replay owns its own list while active)
  useEffect(() => {
    if (dataSourceMode !== 'idle') return
    // Only clear when we were showing live bridge topics; avoid wiping during SSR
    setTopics((prev) => (prev.length === 0 ? prev : []))
    setVisibility((prev) => (Object.keys(prev).length === 0 ? prev : {}))
  }, [dataSourceMode, setTopics, setVisibility])
}
