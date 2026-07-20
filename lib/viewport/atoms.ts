import { atom } from 'jotai'
import type { ViewportRenderQuality } from '@/lib/viewport/visual-config'

/** 视口默认地面网格（独立于场景 Ground 节点） */
export const viewportGridVisibleAtom = atom(true)

/** Sun 按钮：Room IBL（Environment preset="room"）开关 */
export const viewportDefaultLightsVisibleAtom = atom(true)

/**
 * 视口着色模式（显示偏好，不进撤销栈）。
 * shaded = 正常材质；solid = 无贴图灰色；wireframe / normals = overrideMaterial
 */
export type ViewportShading = 'shaded' | 'solid' | 'wireframe' | 'normals'
export const viewportShadingAtom = atom<ViewportShading>('shaded')

/**
 * 后处理质量档位（需 VIEWPORT_WEBGPU_FEATURES.postProcessing === true）。
 * 当前仅驱动轻量 Bloom；N8AO 在预设中保持 null。
 */
export type { ViewportRenderQuality }
export const viewportRenderQualityAtom = atom<ViewportRenderQuality>('performance')
