'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { MOUSE } from 'three'
import * as THREE from 'three'
import { SceneRenderer } from './scene-renderer'
import { ViewportEffects } from './viewport-effects'
import { ViewportToneMapping } from './viewport-tone-mapping'
import { ViewportPicker } from './viewport-picker'
import { ViewportNavigation } from './viewport-navigation'
import { CANVAS_GL_CONFIG } from '@/lib/viewport/visual-config'

/** Blender-style: 左键选择，中键 Orbit 旋转，滚轮缩放 */
export function SceneCanvas() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      gl={{
        antialias: CANVAS_GL_CONFIG.antialias,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: CANVAS_GL_CONFIG.toneMappingExposure,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [6, 5, 8], fov: 50 }}
      className="absolute inset-0"
    >
      <Suspense fallback={null}>
        <ViewportToneMapping />
        <ViewportEffects />
        <SceneRenderer />
      </Suspense>
      <ViewportPicker />
      <ViewportNavigation />
      <OrbitControls
        makeDefault
        enableDamping={false}
        mouseButtons={{
          LEFT: undefined as unknown as MOUSE,
          MIDDLE: MOUSE.ROTATE,
          RIGHT: undefined as unknown as MOUSE,
        }}
      />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  )
}