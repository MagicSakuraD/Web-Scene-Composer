'use client'

import { useAtomValue } from 'jotai'
import { viewportDefaultLightsVisibleAtom } from '@/lib/viewport/atoms'
import { PHYSICAL_LIGHTS_CONFIG } from '@/lib/viewport/visual-config'

/**
 * Sun 开启时的半球环境光（点光由场景树 Physical Light 节点渲染）。
 */
export function ViewportPhysicalLights() {
  const enabled = useAtomValue(viewportDefaultLightsVisibleAtom)
  if (!enabled) return null

  const { hemisphere } = PHYSICAL_LIGHTS_CONFIG

  return (
    <hemisphereLight
      args={[hemisphere.skyColor, hemisphere.groundColor, hemisphere.intensity]}
    />
  )
}
