'use client'

import { useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import * as THREE from 'three'
import {
  simulateStatusAtom,
  simulateErrorAtom,
  simulateLogsAtom,
  runtimeRobotNodeIdAtom,
} from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { appendSimulateLog } from '@/lib/ros/simulate-actions'
import { sceneNodesAtom, updateNodeTransformAtom } from '@/lib/scene/atoms'

export function useSimulate() {
  const [status, setStatus] = useAtom(simulateStatusAtom)
  const [error, setError] = useAtom(simulateErrorAtom)
  const setLogs = useSetAtom(simulateLogsAtom)
  const setRuntimeRobot = useSetAtom(runtimeRobotNodeIdAtom)
  const setTransform = useSetAtom(updateNodeTransformAtom)
  const setNodes = useSetAtom(sceneNodesAtom)

  const pushLog = useCallback(
    (entry: Parameters<typeof appendSimulateLog>[1]) => {
      setLogs((prev) => appendSimulateLog(prev, entry))
    },
    [setLogs],
  )

  const toggleSimulate = useCallback(async () => {
    if (status === 'connected' || status === 'connecting') {
      foxgloveManager.disconnect()
      setStatus('idle')
      setError(null)
      pushLog({ level: 'info', message: 'Simulate 已停止' })
      return
    }

    setStatus('connecting')
    setError(null)
    pushLog({ level: 'info', message: '正在连接 Foxglove Bridge…' })

    try {
      await foxgloveManager.connect(pushLog, (pose) => {
        if (!pose) return
        setNodes((currentNodes) => {
          const robotId = Object.values(currentNodes).find((n) => n.type === 'asset-ref')?.id
          if (!robotId) return currentNodes

          setRuntimeRobot(robotId)
          const q = new THREE.Quaternion(
            pose.orientation.x,
            pose.orientation.y,
            pose.orientation.z,
            pose.orientation.w,
          )
          const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ')
          setTransform({
            id: robotId,
            transform: {
              position: [pose.position.x, pose.position.y, pose.position.z],
              rotation: [
                THREE.MathUtils.radToDeg(euler.x),
                THREE.MathUtils.radToDeg(euler.y),
                THREE.MathUtils.radToDeg(euler.z),
              ],
            },
          })
          return currentNodes
        })
      })
      setStatus('connected')
      const url = foxgloveManager.getConnectedUrl()
      pushLog({
        level: 'info',
        message: `Simulate 已连接${url ? ` (${url})` : ''} — 添加「差速驱动控制器」组件后可发布 /cmd_vel`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setError(msg)
      pushLog({ level: 'error', message: msg })
    }
  }, [status, pushLog, setStatus, setError, setRuntimeRobot, setTransform, setNodes])

  return { status, error, toggleSimulate, isActive: status === 'connected' }
}
