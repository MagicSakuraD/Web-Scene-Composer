import { atom } from 'jotai'

/** Foxglove-style hover tooltip for annotation boxes */
export interface AnnotationHoverInfo {
  label: string
  topic?: string
  source: 'scene-update' | 'editable'
  clientX: number
  clientY: number
}

export const annotationHoverAtom = atom<AnnotationHoverInfo | null>(null)

let tooltipEl: HTMLDivElement | null = null

export function bindAnnotationHoverTooltipEl(el: HTMLDivElement | null) {
  tooltipEl = el
}

/** Move tooltip without a React re-render (pointermove). */
export function moveAnnotationHoverTooltip(clientX: number, clientY: number) {
  if (!tooltipEl) return
  tooltipEl.style.left = `${clientX + 14}px`
  tooltipEl.style.top = `${clientY + 14}px`
}
