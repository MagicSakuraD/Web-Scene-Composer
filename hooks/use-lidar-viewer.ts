'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { lidarDisplayAtom, simulateStatusAtom } from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

/** 雷达 Tab 打开且 visible 时订阅 PointCloud2 */
export function useLidarViewer(active: boolean) {
  const status = useAtomValue(simulateStatusAtom)
  const config = useAtomValue(lidarDisplayAtom)
  const topic = config.topic.trim()

  useEffect(() => {
    if (!active || !config.visible || status !== 'connected' || !topic) return

    const unsub = foxgloveManager.subscribePointCloud(topic, (_, cloud) => {
      lidarPointStore.setCloud(topic, cloud)
    })

    return () => {
      unsub()
      lidarPointStore.clearAll()
    }
  }, [active, config.visible, status, topic])
}
