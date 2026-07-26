'use client'

import { useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { appModeAtom } from '@/lib/playback/atoms'
import { syncSidePanelsToAppModeAtom } from '@/lib/workspace/atoms'

/**
 * After mount (and when appMode changes), restore side panel types from localStorage.
 * Never read storage during SSR / first paint — avoids hydration mismatch.
 */
export function SidePanelModeSync() {
  const appMode = useAtomValue(appModeAtom)
  const sync = useSetAtom(syncSidePanelsToAppModeAtom)

  useEffect(() => {
    sync(appMode)
  }, [appMode, sync])

  return null
}
