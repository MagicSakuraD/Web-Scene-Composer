'use client'

import { Suspense } from 'react'
import { Environment } from '@react-three/drei'
import { useAtomValue } from 'jotai'
import { viewportDefaultLightsVisibleAtom } from '@/lib/viewport/atoms'
import { ROOM_IBL_CONFIG } from '@/lib/viewport/visual-config'

/**
 * Sun 按钮开启：drei Environment IBL（HDRI + PMREM）。
 * preset 见 ROOM_IBL_CONFIG（当前 studio；无 preset="room"）。
 */
export function ViewportEffects() {
  const enabled = useAtomValue(viewportDefaultLightsVisibleAtom)
  if (!enabled) return null

  return (
    <Suspense fallback={null}>
      <Environment
        preset={ROOM_IBL_CONFIG.preset}
        background={ROOM_IBL_CONFIG.background}
        environmentIntensity={ROOM_IBL_CONFIG.environmentIntensity}
      />
    </Suspense>
  )
}

// ── 旧方案（Physical Lights / warehouse HDRI）────────────────────────────
// import { ViewportPhysicalLights } from './viewport-physical-lights'
// <Environment preset="warehouse" ... />
// Reinhard + distantLight + hemisphere
