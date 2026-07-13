'use client'

import { useEffect } from 'react'
import { foxgloveManager } from '@/lib/foxglove/client-manager'

/** Tab 存在即订阅 Nav2 feedback/status */
export function NavGoalRuntime() {
  useEffect(() => {
    foxgloveManager.enableNavGoalTracking(true)
    return () => foxgloveManager.enableNavGoalTracking(false)
  }, [])
  return null
}
