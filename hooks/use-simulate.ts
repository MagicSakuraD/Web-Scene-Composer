'use client'

import { useCallback } from 'react'
import { useAtom, useSetAtom, getDefaultStore } from 'jotai'
import {
  simulateStatusAtom,
  simulateErrorAtom,
  simulateLogsAtom,
  runtimeRobotNodeIdAtom,
} from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { appendSimulateLog } from '@/lib/ros/simulate-actions'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import {
  findSimulateTargetNodeId,
  getSimulateTargetLabel,
} from '@/lib/ros/resolve-robot-base'
import { sceneNodesAtom } from '@/lib/scene/atoms'
import { clearRuntimeAnimCache } from '@/components/viewport/runtime-robot-sync'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

export function useSimulate() {
  const [status, setStatus] = useAtom(simulateStatusAtom)
  const [error, setError] = useAtom(simulateErrorAtom)
  const setLogs = useSetAtom(simulateLogsAtom)
  const setRuntimeRobot = useSetAtom(runtimeRobotNodeIdAtom)

  const pushLog = useCallback(
    (entry: Parameters<typeof appendSimulateLog>[1]) => {
      setLogs((prev) => appendSimulateLog(prev, entry))
    },
    [setLogs],
  )

  const resolveRobotNodeId = useCallback(() => {
    if (runtimePoseStore.robotNodeId) return runtimePoseStore.robotNodeId

    const nodes = getDefaultStore().get(sceneNodesAtom)
    const targetId = findSimulateTargetNodeId(nodes)
    if (targetId) {
      runtimePoseStore.setRobotNodeId(targetId)
      setRuntimeRobot(targetId)
      const label = getSimulateTargetLabel(nodes, targetId)
      pushLog({ level: 'info', message: `Odom 绑定目标: ${label}` })
    }
    return targetId
  }, [setRuntimeRobot, pushLog])

  const toggleSimulate = useCallback(async () => {
    if (status === 'connected' || status === 'connecting') {
      clearRuntimeAnimCache(runtimePoseStore.robotNodeId)
      cameraFrameStore.clearAll()
      lidarPointStore.clearAll()
      foxgloveManager.disconnect()
      runtimePoseStore.reset()
      setRuntimeRobot(null)
      setStatus('idle')
      setError(null)
      pushLog({ level: 'info', message: 'Simulate 已停止' })
      return
    }

    setStatus('connecting')
    setError(null)
    pushLog({ level: 'info', message: '正在连接 Foxglove Bridge…' })

    try {
      await foxgloveManager.connect(pushLog, (odom) => {
        if (!odom) return
        if (!runtimePoseStore.robotNodeId) resolveRobotNodeId()
        runtimePoseStore.setFromOdom(odom)
      })
      resolveRobotNodeId()
      setStatus('connected')
      const url = foxgloveManager.getConnectedUrl()
      pushLog({
        level: 'info',
        message: `Simulate 已连接${url ? ` (${url})` : ''} — 订阅 /chassis/odom`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      runtimePoseStore.reset()
      setRuntimeRobot(null)
      setStatus('error')
      setError(msg)
      pushLog({ level: 'error', message: msg })
    }
  }, [status, pushLog, setStatus, setError, setRuntimeRobot, resolveRobotNodeId])

  return { status, error, toggleSimulate, isActive: status === 'connected' }
}
