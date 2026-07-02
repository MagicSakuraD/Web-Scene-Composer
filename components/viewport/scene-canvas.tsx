'use client'

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { MOUSE } from 'three'
import * as THREE from 'three'
import { WebGPURenderer } from 'three/webgpu'
import { SceneRenderer } from './scene-renderer'
import { ViewportEffects } from './viewport-effects'
import { ViewportToneMapping } from './viewport-tone-mapping'
import { ViewportPicker } from './viewport-picker'
import { ViewportNavigation } from './viewport-navigation'
import { CANVAS_GL_CONFIG } from '@/lib/viewport/visual-config'
import { patchRendererForLegacyCompat } from '@/lib/viewport/patch-renderer-compat'

type ViewportRenderer = THREE.WebGLRenderer | WebGPURenderer

/** ACES + sRGB：Sun 开关时的曝光由 ViewportToneMapping 动态调整 */
function applyViewportRendererDefaults(renderer: ViewportRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = CANVAS_GL_CONFIG.toneMappingExposure
  renderer.outputColorSpace = THREE.SRGBColorSpace
}

/**
 * R3F v9：gl 回调接收 constructor props（含 canvas），WebGPURenderer 须 await init()。
 * WebGPURenderer 在不支持 WebGPU 时会自动降级 WebGL；自定义 GLSL 未迁 TSL 前见 CANVAS_GL_CONFIG.forceWebGL。
 */
async function createViewportRenderer(
  props: THREE.WebGLRendererParameters,
): Promise<ViewportRenderer> {
  const renderer = new WebGPURenderer({
    ...props,
    antialias: CANVAS_GL_CONFIG.antialias,
    forceWebGL: CANVAS_GL_CONFIG.forceWebGL,
  })
  await renderer.init()
  console.log(renderer.backend.constructor.name)
  patchRendererForLegacyCompat(renderer)
  applyViewportRendererDefaults(renderer)
  return renderer
}

/** Blender-style: 左键选择，中键 Orbit 旋转，滚轮缩放 */
export function SceneCanvas() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      gl={createViewportRenderer}
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
