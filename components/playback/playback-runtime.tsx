'use client'

import { useMcapOdomBridge } from '@/hooks/use-mcap-odom-bridge'
import { usePlaybackShortcuts } from '@/hooks/use-playback-shortcuts'
import { useTopicVisibilityBridge } from '@/hooks/use-topic-visibility-bridge'

/** 回放模式副作用：odom 桥接、快捷键、Topic 显隐同步 */
export function PlaybackRuntime() {
  useMcapOdomBridge()
  usePlaybackShortcuts()
  useTopicVisibilityBridge()
  return null
}
