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
 * Topic 树显隐 → 摄像头网格与雷达点云（live Bridge 与 MCAP 回放共用）。
 * 点云：同时只激活一个可见话题。
 */
export function useTopicVisibilityBridge() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const [visibility, setVisibility] = useAtom(topicVisibilityAtom)
  const setCameraTopics = useSetAtom(cameraViewerTopicsAtom)
  const setLidarDisplay = useSetAtom(lidarDisplayAtom)
  const lidarTopicRef = useRef('')

  useEffect(() => {
    if (dataSourceMode !== 'replay' && dataSourceMode !== 'live') return

    const isLive = dataSourceMode === 'live'

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
      followRobot: isLive,
      extraRotationX: isLive ? prev.extraRotationX : 0,
      extraRotationY: isLive ? prev.extraRotationY : 0,
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
