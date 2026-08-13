'use client'

import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import {
  cameraViewerTopicsAtom,
  lidarDisplayAtom,
  laserScanDisplayAtom,
} from '@/lib/ros/atoms'
import {
  isCameraImageTopic,
  isLaserScanTopic,
  isLidarPointCloudTopic,
  preferCompressedCameraTopics,
} from '@/lib/foxglove/ros-serialization'

/**
 * Topic 树显隐 → 摄像头预览列表 / 点云 / LaserScan（live 与 MCAP 共用）。
 * 图像：眼睛为唯一真相 → cameraViewerTopicsAtom（面板只预览，不单独拥有订阅）。
 * 点云：同时只激活一个；LaserScan：可同时多个。
 */
export function useTopicVisibilityBridge() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const [visibility, setVisibility] = useAtom(topicVisibilityAtom)
  const setCameraTopics = useSetAtom(cameraViewerTopicsAtom)
  const setLidarDisplay = useSetAtom(lidarDisplayAtom)
  const setLaserScanDisplay = useSetAtom(laserScanDisplayAtom)
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

    const visibleLaserScans = topics
      .filter(
        (t) =>
          visibility[t.topic] === true &&
          isLaserScanTopic(t.topic, t.schemaName),
      )
      .map((t) => t.topic)

    setLaserScanDisplay((prev) => {
      const same =
        prev.topics.length === visibleLaserScans.length &&
        prev.topics.every((t, i) => t === visibleLaserScans[i])
      return same ? prev : { ...prev, topics: visibleLaserScans }
    })

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
    setLaserScanDisplay,
    setVisibility,
  ])
}
