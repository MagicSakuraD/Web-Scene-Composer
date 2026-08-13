'use client'

import { useEffect, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  dataSourceActiveAtom,
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import {
  cameraFrustumByTopicAtom,
  DEFAULT_CAMERA_FRUSTUM,
} from '@/lib/ros/atoms'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { cameraInfoStore } from '@/lib/ros/camera-info-store'
import { isCameraInfoTopic } from '@/lib/ros/resolve-camera-topics'

/**
 * camera_info 眼睛 → 仅订阅标定、画视锥线框。
 * 图像眼睛由 topicVisibilityBridge + useCameraViewer 单独订阅，互不强制绑定。
 */
export function useCameraFrustum() {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const visibility = useAtomValue(topicVisibilityAtom)
  const setFrustumByTopic = useSetAtom(cameraFrustumByTopicAtom)

  const enabledInfoTopics = useMemo(() => {
    return topics
      .filter(
        (t) =>
          visibility[t.topic] === true &&
          isCameraInfoTopic(t.topic, t.schemaName),
      )
      .map((t) => t.topic)
  }, [topics, visibility])

  useEffect(() => {
    if (enabledInfoTopics.length === 0) return

    setFrustumByTopic((prev) => {
      let changed = false
      const next = { ...prev }
      for (const topic of enabledInfoTopics) {
        if (!next[topic]) {
          next[topic] = { ...DEFAULT_CAMERA_FRUSTUM, enabled: true }
          changed = true
        } else if (!next[topic].enabled) {
          next[topic] = { ...next[topic], enabled: true }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [enabledInfoTopics, setFrustumByTopic])

  useEffect(() => {
    setFrustumByTopic((prev) => {
      let changed = false
      const next = { ...prev }
      for (const [topic, settings] of Object.entries(prev)) {
        const vis = visibility[topic] === true
        if (settings.enabled !== vis) {
          next[topic] = { ...settings, enabled: vis }
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [visibility, setFrustumByTopic])

  useEffect(() => {
    if (
      !dataSourceActive ||
      (dataSourceMode !== 'replay' && dataSourceMode !== 'live') ||
      enabledInfoTopics.length === 0
    ) {
      return
    }

    const unsubs: Array<() => void> = []
    const infoTopics = [...enabledInfoTopics]

    const subscribeInfo =
      dataSourceMode === 'live'
        ? foxgloveManager.subscribeCameraInfo.bind(foxgloveManager)
        : mcapReplayController.subscribeCameraInfo.bind(mcapReplayController)

    for (const infoTopic of infoTopics) {
      unsubs.push(
        subscribeInfo(infoTopic, (_, info) => {
          cameraInfoStore.set(info)
        }),
      )
    }

    return () => {
      unsubs.forEach((u) => u())
      for (const infoTopic of infoTopics) {
        cameraInfoStore.clearTopic(infoTopic)
      }
    }
  }, [dataSourceActive, dataSourceMode, enabledInfoTopics])
}
