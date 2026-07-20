'use client'

import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import { cameraViewerTopicsAtom, lidarDisplayAtom } from '@/lib/ros/atoms'
import {
  isCameraImageTopic,
  isLidarPointCloudTopic,
  preferCompressedCameraTopics,
} from '@/lib/foxglove/ros-serialization'

/**
 * 将 Topic 树显隐同步到摄像头网格与雷达点云订阅（回放模式）。
 * 点云：同时只激活一个可见话题（后开的覆盖先前的）。
 */
export function useTopicVisibilityBridge() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const [visibility, setVisibility] = useAtom(topicVisibilityAtom)
  const setCameraTopics = useSetAtom(cameraViewerTopicsAtom)
  const setLidarDisplay = useSetAtom(lidarDisplayAtom)
  const lidarTopicRef = useRef('')

  useEffect(() => {
    if (dataSourceMode !== 'replay') return

    const visibleCameras = preferCompressedCameraTopics(
      topics
        .filter(
          (t) =>
            visibility[t.topic] === true &&
            isCameraImageTopic(t.topic, t.schemaName),
        )
        .map((t) => t.topic),
    )
    setCameraTopics(visibleCameras)

    const visiblePointClouds = topics.filter(
      (t) =>
        visibility[t.topic] === true &&
        isLidarPointCloudTopic(t.topic, t.schemaName),
    )

    if (visiblePointClouds.length === 0) {
      lidarTopicRef.current = ''
      setLidarDisplay((prev) => ({ ...prev, visible: false }))
      return
    }

    // 多选时只保留一个：优先当前已激活话题，否则取最后一个可见项
    let active =
      visiblePointClouds.find((t) => t.topic === lidarTopicRef.current) ??
      visiblePointClouds[visiblePointClouds.length - 1]

    if (visiblePointClouds.length > 1) {
      const keep = active.topic
      const nextVis = { ...visibility }
      let changed = false
      for (const t of visiblePointClouds) {
        if (t.topic !== keep && nextVis[t.topic]) {
          nextVis[t.topic] = false
          changed = true
        }
      }
      if (changed) {
        setVisibility(nextVis)
        return
      }
    }

    lidarTopicRef.current = active.topic
    setLidarDisplay((prev) => ({
      ...prev,
      topic: active.topic,
      visible: true,
      followRobot: false,
      extraRotationX: 0,
      extraRotationY: 0,
    }))
  }, [
    dataSourceMode,
    topics,
    visibility,
    setCameraTopics,
    setLidarDisplay,
    setVisibility,
  ])
}
