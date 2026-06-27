import { atom } from 'jotai'

/** 视口默认地面网格（独立于场景 Ground 节点） */
export const viewportGridVisibleAtom = atom(true)

/** Sun 按钮：Room IBL（Environment preset="room"）开关 */
export const viewportDefaultLightsVisibleAtom = atom(true)

import type { ViewportRenderQuality } from '@/lib/viewport/visual-config'

/**
 * 后处理 / HDRI 质量档位（默认 balanced）。
 * performance：N8AO low + 低 Bloom + 无 MSAA。
 * balanced：N8AO medium + 适中 Bloom + MSAA×4。
 */
export type { ViewportRenderQuality }
export const viewportRenderQualityAtom = atom<ViewportRenderQuality>('balanced')
