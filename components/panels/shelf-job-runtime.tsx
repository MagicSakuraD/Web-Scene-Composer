'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'

/** 仿真连接后订阅 /job/status；与 Tab 是否打开无关 */
export function ShelfJobRuntime() {
  const simulateStatus = useAtomValue(simulateStatusAtom)

  useEffect(() => {
    foxgloveManager.enableShelfJobTracking(true)
    return () => foxgloveManager.enableShelfJobTracking(false)
  }, [])

  useEffect(() => {
    if (simulateStatus === 'connected') {
      foxgloveManager.enableShelfJobTracking(true)
    }
  }, [simulateStatus])

  return null
}
