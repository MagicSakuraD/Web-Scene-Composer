'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { viewportDefaultLightsVisibleAtom } from '@/lib/viewport/atoms'
import { CANVAS_GL_CONFIG, ROOM_IBL_CONFIG } from '@/lib/viewport/visual-config'

/**
 * Sun 开：coffeemat 示例同款 ACES + exposure≈1；Sun 关：略降曝光。
 */
export function ViewportToneMapping() {
  const iblOn = useAtomValue(viewportDefaultLightsVisibleAtom)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = iblOn
      ? ROOM_IBL_CONFIG.toneMappingExposure
      : CANVAS_GL_CONFIG.toneMappingExposure
  }, [iblOn, gl])

  return null
}
