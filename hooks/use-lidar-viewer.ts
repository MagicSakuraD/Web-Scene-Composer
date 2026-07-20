'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { lidarDisplayAtom } from '@/lib/ros/atoms'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

/** 雷达 Tab 打开且 visible 时订阅 PointCloud2（Live 或 MCAP） */
export function useLidarViewer(active: boolean) {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const config = useAtomValue(lidarDisplayAtom)
  const topic = config.topic.trim()

  useEffect(() => {
    if (!active || !config.visible || !dataSourceActive || !topic) return

    if (dataSourceMode === 'live') {
      const unsub = foxgloveManager.subscribePointCloud(topic, (_, cloud) => {
        lidarPointStore.setCloud(topic, cloud)
      })
      return () => {
        unsub()
        lidarPointStore.clearAll()
      }
    }

    if (dataSourceMode === 'replay') {
      const unsub = mcapReplayController.subscribePointCloud(topic, (_, cloud) => {
        lidarPointStore.setCloud(topic, cloud)
      })
      return () => {
        unsub()
        lidarPointStore.clearAll()
      }
    }
  }, [active, config.visible, dataSourceActive, dataSourceMode, topic])
}
