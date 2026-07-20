'use client'

import { useCallback } from 'react'
import { useSetAtom } from 'jotai'
import {
  appModeAtom,
  dataSourceModeAtom,
  mcapFileNameAtom,
  mcapTopicsAtom,
  playbackRangeAtom,
  playbackTimeNsAtom,
  playbackPlayingAtom,
  topicVisibilityAtom,
  mcapLoadErrorAtom,
  mcapLoadingAtom,
  selectedTopicAtom,
} from '@/lib/playback/atoms'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'
import { playbackEngine } from '@/lib/playback/playback-engine'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import {
  cameraViewerTopicsAtom,
  lidarDisplayAtom,
  simulateStatusAtom,
} from '@/lib/ros/atoms'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { odomSceneCalibration } from '@/lib/ros/odom-scene-calibration'
import { getDefaultStore } from 'jotai'

export function useOpenMcap() {
  const setAppMode = useSetAtom(appModeAtom)
  const setDataSourceMode = useSetAtom(dataSourceModeAtom)
  const setFileName = useSetAtom(mcapFileNameAtom)
  const setTopics = useSetAtom(mcapTopicsAtom)
  const setRange = useSetAtom(playbackRangeAtom)
  const setPlaybackTime = useSetAtom(playbackTimeNsAtom)
  const setPlaying = useSetAtom(playbackPlayingAtom)
  const setTopicVisibility = useSetAtom(topicVisibilityAtom)
  const setSelectedTopic = useSetAtom(selectedTopicAtom)
  const setError = useSetAtom(mcapLoadErrorAtom)
  const setLoading = useSetAtom(mcapLoadingAtom)
  const setCameraTopics = useSetAtom(cameraViewerTopicsAtom)
  const setLidarDisplay = useSetAtom(lidarDisplayAtom)

  const openFile = useCallback(
    async (file: File) => {
      setLoading(true)
      setError(null)
      playbackEngine.pause()

      try {
        if (getDefaultStore().get(simulateStatusAtom) === 'connected') {
          foxgloveManager.disconnect()
          getDefaultStore().set(simulateStatusAtom, 'idle')
        }

        cameraFrameStore.clearAll()
        lidarPointStore.clearAll()
        runtimePoseStore.reset()
        tfRuntimeStore.reset()
        odomSceneCalibration.reset()

        const { loadMcapFile } = await import('@/lib/mcap/mcap-loader')
        const result = await loadMcapFile(file)
        mcapReplayController.load(result)

        // Foxglove 式：默认全部隐藏，用户点眼睛后才订阅/显示
        const visibility: Record<string, boolean> = {}
        for (const t of result.topics) visibility[t.topic] = false

        setFileName(result.fileName)
        setTopics(result.topics)
        setTopicVisibility(visibility)
        setSelectedTopic(null)
        setCameraTopics([])
        setLidarDisplay((prev) => ({
          ...prev,
          visible: false,
          followRobot: false,
          extraRotationX: 0,
          extraRotationY: 0,
        }))
        setRange({ startNs: result.startTimeNs, endNs: result.endTimeNs })
        setPlaybackTime(result.startTimeNs)
        setPlaying(false)
        setDataSourceMode('replay')
        setAppMode('playback')

        await mcapReplayController.seek(result.startTimeNs)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        mcapReplayController.close()
        setDataSourceMode('idle')
      } finally {
        setLoading(false)
      }
    },
    [
      setAppMode,
      setCameraTopics,
      setDataSourceMode,
      setError,
      setFileName,
      setLidarDisplay,
      setLoading,
      setPlaybackTime,
      setPlaying,
      setRange,
      setSelectedTopic,
      setTopicVisibility,
      setTopics,
    ],
  )

  const closeMcap = useCallback(() => {
    playbackEngine.pause()
    mcapReplayController.close()
    protobufRegistry.reset()
    cameraFrameStore.clearAll()
    lidarPointStore.clearAll()
    runtimePoseStore.reset()
    tfRuntimeStore.reset()
    odomSceneCalibration.reset()
    setDataSourceMode('idle')
    setFileName(null)
    setTopics([])
    setRange(null)
    setPlaybackTime(BigInt(0))
    setTopicVisibility({})
    setSelectedTopic(null)
    setCameraTopics([])
    setLidarDisplay((prev) => ({ ...prev, visible: false }))
    setError(null)
  }, [
    setCameraTopics,
    setDataSourceMode,
    setError,
    setFileName,
    setLidarDisplay,
    setPlaybackTime,
    setRange,
    setSelectedTopic,
    setTopicVisibility,
    setTopics,
  ])

  return { openFile, closeMcap }
}
