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
