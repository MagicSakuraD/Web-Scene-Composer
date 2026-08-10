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
import { cameraInfoStore } from '@/lib/ros/camera-info-store'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'
import { isCameraInfoTopic, resolveImageTopicForInfo } from '@/lib/ros/resolve-camera-topics'

/** 启用中的 camera_info 话题：订阅标定 + 配对图像写入 frame store */
export function useCameraFrustum() {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const visibility = useAtomValue(topicVisibilityAtom)
  const setFrustumByTopic = useSetAtom(cameraFrustumByTopicAtom)
  const setVisibility = useSetAtom(topicVisibilityAtom)

  const availableTopics = useMemo(() => topics.map((t) => t.topic), [topics])

  const enabledInfoTopics = useMemo(() => {
    return topics
      .filter(
        (t) =>
          visibility[t.topic] === true &&
          isCameraInfoTopic(t.topic, t.schemaName),
      )
      .map((t) => t.topic)
  }, [topics, visibility])

  // Ensure settings exist + auto-enable paired image when camera_info becomes visible
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

    setVisibility((prev) => {
      let changed = false
      const next = { ...prev }
      for (const infoTopic of enabledInfoTopics) {
        const imageTopic = resolveImageTopicForInfo(infoTopic, availableTopics)
        if (imageTopic && next[imageTopic] !== true) {
          next[imageTopic] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [enabledInfoTopics, availableTopics, setFrustumByTopic, setVisibility])

  // Mark frustum disabled when eye turns off
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
    if (!dataSourceActive || dataSourceMode !== 'replay' || enabledInfoTopics.length === 0) {
      return
    }

    const unsubs: Array<() => void> = []
    const infoTopics = [...enabledInfoTopics]

    for (const infoTopic of infoTopics) {
      unsubs.push(
        mcapReplayController.subscribeCameraInfo(infoTopic, (_, info) => {
          cameraInfoStore.set(info)
        }),
      )
      const imageTopic = resolveImageTopicForInfo(infoTopic, availableTopics)
      if (imageTopic) {
        unsubs.push(
          mcapReplayController.subscribeImage(imageTopic, (_, frame) => {
            cameraFrameStore.setFrame(imageTopic, frame)
          }),
        )
      }
    }

    return () => {
      unsubs.forEach((u) => u())
      for (const infoTopic of infoTopics) {
        cameraInfoStore.clearTopic(infoTopic)
      }
    }
  }, [dataSourceActive, dataSourceMode, enabledInfoTopics, availableTopics])
}
