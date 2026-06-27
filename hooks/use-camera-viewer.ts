'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'

/** 摄像头面板：按选中话题订阅 image_raw，写入 cameraFrameStore */
export function useCameraViewer(topics: string[], active: boolean) {
  const status = useAtomValue(simulateStatusAtom)
  const topicsKey = topics.join('\0')

  useEffect(() => {
    if (!active || status !== 'connected' || topics.length === 0) return

    const unsubs = topics.map((topic) =>
      foxgloveManager.subscribeImage(topic, (_, frame) => {
        cameraFrameStore.setFrame(topic, frame)
      }),
    )

    return () => {
      unsubs.forEach((u) => u())
      for (const topic of topics) {
        cameraFrameStore.clearTopic(topic)
      }
    }
  }, [active, status, topicsKey, topics])
}
