import { atom } from 'jotai'

/** 视口默认地面网格（独立于场景 Ground 节点） */
export const viewportGridVisibleAtom = atom(true)

/** Sun 按钮：Room IBL（Environment preset="room"）开关 */
export const viewportDefaultLightsVisibleAtom = atom(true)

import type { ViewportRenderQuality } from '@/lib/viewport/visual-config'

/**
 * 后处理质量档位（需 VIEWPORT_WEBGPU_FEATURES.postProcessing === true）。
 * 当前仅驱动轻量 Bloom；N8AO 在预设中保持 null。
 */
export type { ViewportRenderQuality }
export const viewportRenderQualityAtom = atom<ViewportRenderQuality>('performance')
