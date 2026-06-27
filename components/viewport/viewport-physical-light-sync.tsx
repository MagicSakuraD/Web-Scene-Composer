'use client'

import { useEffect } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { expandedNodesAtom, sceneNodesAtom } from '@/lib/scene/atoms'
import { viewportDefaultLightsVisibleAtom } from '@/lib/viewport/atoms'
import {
  VIEWPORT_PHYSICAL_LIGHT_ID,
  buildViewportPhysicalLightNode,
} from '@/lib/viewport/physical-light-node'

/** Sun 开：在 Root 下挂载/保留 Physical Light 节点；Sun 关：从场景树移除 */
export function ViewportPhysicalLightSync() {
  const [enabled] = useAtom(viewportDefaultLightsVisibleAtom)
  const setNodes = useSetAtom(sceneNodesAtom)
  const setExpanded = useSetAtom(expandedNodesAtom)

  useEffect(() => {
    if (enabled) {
      setNodes((prev) => ({
        ...prev,
        [VIEWPORT_PHYSICAL_LIGHT_ID]: buildViewportPhysicalLightNode(
          prev[VIEWPORT_PHYSICAL_LIGHT_ID],
        ),
      }))
      setExpanded((prev) => new Set([...prev, 'root', VIEWPORT_PHYSICAL_LIGHT_ID]))
    } else {
      setNodes((prev) => {
        if (!prev[VIEWPORT_PHYSICAL_LIGHT_ID]) return prev
        const next = { ...prev }
        delete next[VIEWPORT_PHYSICAL_LIGHT_ID]
        return next
      })
    }
  }, [enabled, setNodes, setExpanded])

  return null
}
