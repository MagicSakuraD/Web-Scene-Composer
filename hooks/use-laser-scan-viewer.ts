'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { laserScanDisplayAtom } from '@/lib/ros/atoms'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { laserScanStore } from '@/lib/ros/laser-scan-store'

/** 对 laserScanDisplayAtom.topics 中每个话题订阅 LaserScan */
export function useLaserScanViewer(active: boolean) {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const config = useAtomValue(laserScanDisplayAtom)
  const topicsKey = config.topics.join('\0')

  useEffect(() => {
    if (!active || !dataSourceActive || config.topics.length === 0) return

    const topics = [...config.topics]
    const unsubs: Array<() => void> = []

    if (dataSourceMode === 'live') {
      for (const topic of topics) {
        unsubs.push(
          foxgloveManager.subscribeLaserScan(topic, (_, scan) => {
            laserScanStore.setScan(topic, scan)
          }),
        )
      }
    } else if (dataSourceMode === 'replay') {
      for (const topic of topics) {
        unsubs.push(
          mcapReplayController.subscribeLaserScan(topic, (_, scan) => {
            laserScanStore.setScan(topic, scan)
          }),
        )
      }
    } else {
      return
    }

    return () => {
      unsubs.forEach((u) => u())
      for (const topic of topics) {
        laserScanStore.clearTopic(topic)
      }
    }
  }, [active, dataSourceActive, dataSourceMode, topicsKey, config.topics])
}
