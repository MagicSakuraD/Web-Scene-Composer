import type { AnnotationKeyframe, AnnotationTrack } from '@/lib/annotations/types'
import { sortKeyframes } from '@/lib/annotations/types'

/**
 * Serialize tracks for persistence / future MCAP writer.
 * bigint → string so JSON.stringify works.
 */
export interface AnnotationDocumentV1 {
  format: 'wsc-annotations-v1'
  /** Target encoding for later export; UI may write mcap later */
  preferredContainer: 'mcap' | 'json'
  tracks: Array<{
    id: string
    label: string
    frameId: string
    color: [number, number, number, number]
    source: AnnotationTrack['source']
    keyframes: Array<{
      timeNs: string
      position: [number, number, number]
      orientation: [number, number, number, number]
      size: [number, number, number]
    }>
  }>
}

export function tracksToDocument(
  tracks: AnnotationTrack[],
  preferredContainer: 'mcap' | 'json' = 'mcap',
): AnnotationDocumentV1 {
  return {
    format: 'wsc-annotations-v1',
    preferredContainer,
    tracks: tracks.map((t) => ({
      id: t.id,
      label: t.label,
      frameId: t.frameId,
      color: t.color,
      source: t.source,
      keyframes: sortKeyframes(t.keyframes).map((k) => ({
        timeNs: k.timeNs.toString(),
        position: k.position,
        orientation: k.orientation,
        size: k.size,
      })),
    })),
  }
}

export function documentToTracks(doc: AnnotationDocumentV1): AnnotationTrack[] {
  if (doc.format !== 'wsc-annotations-v1') {
    throw new Error(`Unsupported annotation format: ${String((doc as { format?: string }).format)}`)
  }
  return doc.tracks.map((t) => ({
    id: t.id,
    label: t.label,
    frameId: t.frameId,
    color: t.color,
    source: t.source,
    keyframes: sortKeyframes(
      t.keyframes.map(
        (k): AnnotationKeyframe => ({
          timeNs: BigInt(k.timeNs),
          position: k.position,
          orientation: k.orientation,
          size: k.size,
        }),
      ),
    ),
  }))
}

/** Stub: MCAP round-trip lands in a later phase (foxglove.SceneUpdate channel). */
export function supportsMcapAnnotationIo(): boolean {
  return false
}
