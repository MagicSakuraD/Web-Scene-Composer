'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'

/** Nav Goal Tab 存在时跟踪 Nav2 话题；重连后重新订阅 */
export function NavGoalRuntime() {
  const simulateStatus = useAtomValue(simulateStatusAtom)

  useEffect(() => {
    foxgloveManager.enableNavGoalTracking(true)
    return () => foxgloveManager.enableNavGoalTracking(false)
  }, [])

  useEffect(() => {
    if (simulateStatus === 'connected') {
      foxgloveManager.enableNavGoalTracking(true)
    }
  }, [simulateStatus])

  return null
}
