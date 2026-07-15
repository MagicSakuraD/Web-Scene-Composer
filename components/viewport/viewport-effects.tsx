'use client'

import { Suspense } from 'react'
import { Environment } from '@react-three/drei'
import { useAtomValue } from 'jotai'
import { viewportDefaultLightsVisibleAtom } from '@/lib/viewport/atoms'
import { ROOM_IBL_CONFIG, VIEWPORT_WEBGPU_FEATURES } from '@/lib/viewport/visual-config'

/**
 * Sun 按钮开启：本地 HDR → drei Environment（PMREM IBL）。
 * 不用 CDN preset，避免联网与额外带宽。
 */
export function ViewportEffects() {
  const enabled = useAtomValue(viewportDefaultLightsVisibleAtom)
  if (!enabled || !VIEWPORT_WEBGPU_FEATURES.environmentIbl) return null

  return (
    <Suspense fallback={null}>
      <Environment
        files={ROOM_IBL_CONFIG.files}
        resolution={ROOM_IBL_CONFIG.resolution}
        background={ROOM_IBL_CONFIG.background}
        environmentIntensity={ROOM_IBL_CONFIG.environmentIntensity}
      />
    </Suspense>
  )
}
