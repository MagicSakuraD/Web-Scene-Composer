import type * as THREE from 'three'
import type { WebGPURenderer } from 'three/webgpu'

type ViewportRenderer = THREE.WebGLRenderer | WebGPURenderer

type RendererWithBackend = ViewportRenderer & {
  capabilities?: THREE.WebGLCapabilities
  backend?: { capabilities?: { getMaxAnisotropy: () => number } }
}

/**
 * drei（GizmoViewport 等）仍读取 gl.capabilities.getMaxAnisotropy()，
 * WebGPURenderer 只在 backend 上暴露 capabilities，此处做桥接。
 */
export function patchRendererForLegacyCompat(renderer: ViewportRenderer) {
  const r = renderer as RendererWithBackend

  if (typeof r.capabilities?.getMaxAnisotropy === 'function') return

  const backendGetMax = r.backend?.capabilities?.getMaxAnisotropy
  const getMaxAnisotropy = backendGetMax
    ? () => backendGetMax.call(r.backend!.capabilities)
    : () => 16

  r.capabilities = { getMaxAnisotropy } as THREE.WebGLCapabilities
}
