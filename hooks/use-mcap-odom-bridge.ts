'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { runtimeRobotNodeIdAtom } from '@/lib/ros/atoms'
import { getDefaultStore } from 'jotai'
import {
  findSimulateTargetNodeId,
  getSimulateTargetLabel,
} from '@/lib/ros/resolve-robot-base'
import { sceneNodesAtom } from '@/lib/scene/atoms'

/** MCAP 回放时注册 odom 处理器，驱动机器人位姿 */
export function useMcapOdomBridge() {
  const active = useAtomValue(dataSourceActiveAtom)
  const mode = useAtomValue(dataSourceModeAtom)

  useEffect(() => {
    if (!active || mode !== 'replay') {
      mcapReplayController.setOdomHandler(null)
      return
    }

    mcapReplayController.setOdomHandler((odom) => {
      if (!runtimePoseStore.robotNodeId) {
        const nodes = getDefaultStore().get(sceneNodesAtom)
        const targetId = findSimulateTargetNodeId(nodes)
        if (targetId) {
          runtimePoseStore.setRobotNodeId(targetId)
          getDefaultStore().set(runtimeRobotNodeIdAtom, targetId)
        }
      }
      runtimePoseStore.setFromOdom(odom)
    })

    return () => {
      mcapReplayController.setOdomHandler(null)
    }
  }, [active, mode])
}
