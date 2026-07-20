'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'

/** 摄像头面板：Live Foxglove 或 MCAP 回放，写入 cameraFrameStore */
export function useCameraViewer(topics: string[], active: boolean) {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topicsKey = topics.join('\0')

  useEffect(() => {
    if (!active || !dataSourceActive || topics.length === 0) return

    if (dataSourceMode === 'live') {
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
    }

    if (dataSourceMode === 'replay') {
      const unsubs = topics.map((topic) =>
        mcapReplayController.subscribeImage(topic, (_, frame) => {
          cameraFrameStore.setFrame(topic, frame)
        }),
      )
      return () => {
        unsubs.forEach((u) => u())
        for (const topic of topics) {
          cameraFrameStore.clearTopic(topic)
        }
      }
    }
  }, [active, dataSourceActive, dataSourceMode, topicsKey, topics])
}
