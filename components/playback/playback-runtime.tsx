'use client'

import { useMcapOdomBridge } from '@/hooks/use-mcap-odom-bridge'
import { usePlaybackShortcuts } from '@/hooks/use-playback-shortcuts'
import { useTopicVisibilityBridge } from '@/hooks/use-topic-visibility-bridge'
import { useLiveTopicsSync } from '@/hooks/use-live-topics-sync'
import { useSceneAnnotations } from '@/hooks/use-scene-annotations'
import { useCameraFrustum } from '@/hooks/use-camera-frustum'
import { useLaserScanViewer } from '@/hooks/use-laser-scan-viewer'
import { LidarRuntime } from '@/components/panels/lidar-runtime'
import { CameraViewerRuntime } from '@/components/panels/camera-viewer-runtime'
import { ShelfJobRuntime } from '@/components/panels/shelf-job-runtime'

function LaserScanRuntime() {
  useLaserScanViewer(true)
  return null
}

/**
 * 全局数据源副作用：MCAP / Live Topics、显隐桥、点云、图像、LaserScan、CameraInfo 视锥。
 */
export function PlaybackRuntime() {
  useMcapOdomBridge()
  usePlaybackShortcuts()
  useLiveTopicsSync()
  useTopicVisibilityBridge()
  useSceneAnnotations()
  useCameraFrustum()
  return (
    <>
      <LidarRuntime />
      <CameraViewerRuntime />
      <LaserScanRuntime />
      <ShelfJobRuntime />
    </>
  )
}
