'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import {
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { isSceneUpdateTopic } from '@/lib/mcap/foxglove-scene-update-decode'
import { sceneEntityStore } from '@/lib/ros/scene-entity-store'

/**
 * Topics 眼睛 → 订阅 foxglove.SceneUpdate → sceneEntityStore（仅 MCAP replay）。
 */
export function useSceneAnnotations() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const visibility = useAtomValue(topicVisibilityAtom)

  useEffect(() => {
    if (dataSourceMode !== 'replay') {
      sceneEntityStore.clearAll()
      return
    }

    const wanted = topics
      .filter(
        (t) =>
          visibility[t.topic] === true &&
          isSceneUpdateTopic(t.topic, t.schemaName),
      )
      .map((t) => t.topic)

    const unsubs = wanted.map((topic) =>
      mcapReplayController.subscribeSceneUpdate(topic, (t, update) => {
        sceneEntityStore.setTopicUpdate(t, update)
      }),
    )

    return () => {
      for (const u of unsubs) u()
      for (const topic of wanted) sceneEntityStore.clearTopic(topic)
    }
  }, [dataSourceMode, topics, visibility])
}
