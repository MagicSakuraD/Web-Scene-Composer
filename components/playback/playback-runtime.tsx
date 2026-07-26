'use client'

import { useMcapOdomBridge } from '@/hooks/use-mcap-odom-bridge'
import { usePlaybackShortcuts } from '@/hooks/use-playback-shortcuts'
import { useTopicVisibilityBridge } from '@/hooks/use-topic-visibility-bridge'
import { useLiveTopicsSync } from '@/hooks/use-live-topics-sync'
import { useSceneAnnotations } from '@/hooks/use-scene-annotations'
import { LidarRuntime } from '@/components/panels/lidar-runtime'

/**
 * 全局数据源副作用：MCAP / Live Topics、显隐桥、点云、SceneUpdate 标注。
 */
export function PlaybackRuntime() {
  useMcapOdomBridge()
  usePlaybackShortcuts()
  useLiveTopicsSync()
  useTopicVisibilityBridge()
  useSceneAnnotations()
  return <LidarRuntime />
}
