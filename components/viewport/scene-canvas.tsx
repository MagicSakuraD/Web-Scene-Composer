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
import { ViewportPostProcessing } from './viewport-post-processing'
import { ViewportPicker } from './viewport-picker'
import { ViewportNavigation } from './viewport-navigation'
import { CANVAS_GL_CONFIG, VIEWPORT_SHADOW_CONFIG, VIEWPORT_WEBGPU_FEATURES } from '@/lib/viewport/visual-config'
import { patchRendererForLegacyCompat } from '@/lib/viewport/patch-renderer-compat'

type ViewportRenderer = THREE.WebGLRenderer | WebGPURenderer

function resolveShadowProp(): boolean | { type: THREE.ShadowMapType } {
  if (!VIEWPORT_SHADOW_CONFIG.enabled) return false
  const type =
    VIEWPORT_SHADOW_CONFIG.type === 'pcfsoft'
      ? THREE.PCFSoftShadowMap
      : THREE.BasicShadowMap
  return { type }
}

/** ACES + sRGB：Sun 开关时的曝光由 ViewportToneMapping 动态调整 */
function applyViewportRendererDefaults(renderer: ViewportRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = CANVAS_GL_CONFIG.toneMappingExposure
  renderer.outputColorSpace = THREE.SRGBColorSpace

  if ('shadowMap' in renderer && renderer.shadowMap) {
    renderer.shadowMap.enabled = VIEWPORT_SHADOW_CONFIG.enabled
    if (VIEWPORT_SHADOW_CONFIG.enabled) {
      renderer.shadowMap.type =
        VIEWPORT_SHADOW_CONFIG.type === 'pcfsoft'
          ? THREE.PCFSoftShadowMap
          : THREE.BasicShadowMap
    }
  }
}

/**
 * R3F v9：gl 回调接收 constructor props（含 canvas），WebGPURenderer 须 await init()。
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

  renderer.onDeviceLost = (info) => {
    console.error('[WebGPU] Device Lost', info)
  }

  return renderer
}

/** Blender-style: 左键选择，中键 Orbit 旋转，滚轮缩放 */
export function SceneCanvas() {
  return (
    <Canvas
      shadows={resolveShadowProp()}
      gl={createViewportRenderer}
      camera={{ position: [6, 5, 8], fov: 50 }}
      className="absolute inset-0"
      dpr={[1, 1.5]}
    >
      <Suspense fallback={null}>
        <ViewportToneMapping />
        <ViewportEffects />
        <SceneRenderer />
        {VIEWPORT_WEBGPU_FEATURES.postProcessing ? <ViewportPostProcessing /> : null}
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
