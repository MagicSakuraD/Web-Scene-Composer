'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import { RenderPipeline } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { viewportRenderQualityAtom } from '@/lib/viewport/atoms'
import { VIEWPORT_WEBGPU_FEATURES, VISUAL_QUALITY_PRESETS } from '@/lib/viewport/visual-config'

/**
 * WebGPU 轻量后处理：仅 TSL Bloom。
 * - 不用 @react-three/postprocessing（仅 WebGL）
 * - 不用 N8AO / DOF / MSAA（仓库场景易 Device Lost）
 * - useFrame priority>0：R3F 跳过默认 gl.render，由 RenderPipeline 接管
 */
export function ViewportPostProcessing() {
  const enabled = VIEWPORT_WEBGPU_FEATURES.postProcessing
  const quality = useAtomValue(viewportRenderQualityAtom)
  const bloomCfg = VISUAL_QUALITY_PRESETS[quality].bloom
  const { gl, scene, camera } = useThree()
  const pipelineRef = useRef<RenderPipeline | null>(null)

  useEffect(() => {
    if (!enabled) {
      pipelineRef.current = null
      return
    }

    try {
      const scenePass = pass(scene, camera)
      const sceneColor = scenePass.getTextureNode('output')
      const bloomPass = bloom(
        sceneColor,
        bloomCfg.intensity,
        bloomCfg.mipmapBlur ? 0.32 : 0.12,
        bloomCfg.luminanceThreshold,
      )

      const pipeline = new RenderPipeline(gl as never)
      pipeline.outputNode = sceneColor.add(bloomPass)
      pipelineRef.current = pipeline
    } catch (err) {
      console.warn('[ViewportPostProcessing] 初始化失败，回退无后处理', err)
      pipelineRef.current = null
    }

    return () => {
      pipelineRef.current = null
    }
  }, [
    enabled,
    gl,
    scene,
    camera,
    bloomCfg.intensity,
    bloomCfg.luminanceThreshold,
    bloomCfg.mipmapBlur,
  ])

  useFrame(() => {
    if (!enabled) return
    pipelineRef.current?.render()
  }, enabled ? 1 : 0)

  return null
}
