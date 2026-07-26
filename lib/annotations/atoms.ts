import { atom } from 'jotai'
import type { DecodedSceneCube } from '@/lib/mcap/foxglove-scene-update-decode'
import {
  createTrackId,
  DEFAULT_BOX_COLOR,
  DEFAULT_BOX_ORIENTATION,
  DEFAULT_BOX_SIZE,
  sampleTracksAt,
  sortKeyframes,
  type AnnotationKeyframe,
  type AnnotationSource,
  type AnnotationTrack,
  type SampledAnnotationBox,
} from '@/lib/annotations/types'
import { playbackTimeNsAtom } from '@/lib/playback/atoms'

export const annotationTracksAtom = atom<AnnotationTrack[]>([])

export const selectedTrackIdAtom = atom<string | null>(null)

/** When true, readonly SceneUpdate cubes stay visible alongside edits */
export const showReadonlySceneAnnotationsAtom = atom(true)

export const selectedTrackAtom = atom((get) => {
  const id = get(selectedTrackIdAtom)
  if (!id) return null
  return get(annotationTracksAtom).find((t) => t.id === id) ?? null
})

/** Step-hold boxes at current playback clock (for viewport). */
export const sampledAnnotationsAtPlayheadAtom = atom((get): SampledAnnotationBox[] => {
  return sampleTracksAt(get(annotationTracksAtom), get(playbackTimeNsAtom))
})

function upsertKeyframe(
  keyframes: AnnotationKeyframe[],
  next: AnnotationKeyframe,
): AnnotationKeyframe[] {
  const sorted = sortKeyframes(keyframes)
  const idx = sorted.findIndex((k) => k.timeNs === next.timeNs)
  if (idx >= 0) {
    const copy = [...sorted]
    copy[idx] = next
    return copy
  }
  return sortKeyframes([...sorted, next])
}

export const addAnnotationTrackAtom = atom(
  null,
  (
    get,
    set,
    partial?: Partial<
      Pick<AnnotationTrack, 'id' | 'label' | 'frameId' | 'color' | 'source'>
    > & {
      keyframe?: Partial<AnnotationKeyframe>
      /** If omitted, uses playback playhead */
      timeNs?: bigint
    },
  ) => {
    const timeNs = partial?.timeNs ?? get(playbackTimeNsAtom)
    const kfPartial = partial?.keyframe
    const keyframe: AnnotationKeyframe = {
      timeNs,
      position: kfPartial?.position ?? [5, 0, 0.75],
      orientation: kfPartial?.orientation ?? [...DEFAULT_BOX_ORIENTATION],
      size: kfPartial?.size ?? [...DEFAULT_BOX_SIZE],
    }
    const track: AnnotationTrack = {
      id: partial?.id ?? createTrackId(),
      label: partial?.label ?? 'object',
      frameId: partial?.frameId ?? 'map',
      color: partial?.color ?? [...DEFAULT_BOX_COLOR],
      source: partial?.source ?? 'manual',
      keyframes: [keyframe],
    }
    set(annotationTracksAtom, [...get(annotationTracksAtom), track])
    set(selectedTrackIdAtom, track.id)
    return track.id
  },
)

export const removeAnnotationTrackAtom = atom(null, (get, set, trackId: string) => {
  set(
    annotationTracksAtom,
    get(annotationTracksAtom).filter((t) => t.id !== trackId),
  )
  if (get(selectedTrackIdAtom) === trackId) {
    set(selectedTrackIdAtom, null)
  }
})

export const clearAnnotationTracksAtom = atom(null, (_get, set) => {
  set(annotationTracksAtom, [])
  set(selectedTrackIdAtom, null)
})

export const updateAnnotationTrackMetaAtom = atom(
  null,
  (
    get,
    set,
    args: {
      trackId: string
      patch: Partial<Pick<AnnotationTrack, 'label' | 'frameId' | 'color' | 'source'>>
    },
  ) => {
    set(
      annotationTracksAtom,
      get(annotationTracksAtom).map((t) =>
        t.id === args.trackId ? { ...t, ...args.patch } : t,
      ),
    )
  },
)

/** Insert or replace keyframe at timeNs on a track. */
export const setAnnotationKeyframeAtom = atom(
  null,
  (
    get,
    set,
    args: {
      trackId: string
      keyframe: AnnotationKeyframe
    },
  ) => {
    set(
      annotationTracksAtom,
      get(annotationTracksAtom).map((t) => {
        if (t.id !== args.trackId) return t
        return {
          ...t,
          keyframes: upsertKeyframe(t.keyframes, args.keyframe),
        }
      }),
    )
  },
)

export const removeAnnotationKeyframeAtom = atom(
  null,
  (get, set, args: { trackId: string; timeNs: bigint }) => {
    set(
      annotationTracksAtom,
      get(annotationTracksAtom).map((t) => {
        if (t.id !== args.trackId) return t
        const keyframes = t.keyframes.filter((k) => k.timeNs !== args.timeNs)
        return { ...t, keyframes }
      }),
    )
  },
)

/**
 * Promote readonly SceneUpdate cubes into editable tracks.
 * Each cube → one track with a single keyframe at `timeNs` (default: playhead).
 */
export const promoteSceneCubesAtom = atom(
  null,
  (
    get,
    set,
    args: {
      cubes: DecodedSceneCube[]
      timeNs?: bigint
      /** Replace existing tracks with same id */
      replaceSameId?: boolean
      source?: AnnotationSource
    },
  ) => {
    const timeNs = args.timeNs ?? get(playbackTimeNsAtom)
    const source = args.source ?? 'scene-update'
    const replaceSameId = args.replaceSameId ?? true

    const incoming: AnnotationTrack[] = args.cubes.map((cube) => {
      const label =
        cube.metadata?.category ??
        cube.metadata?.label ??
        cube.metadata?.class ??
        cube.entityId
      return {
        id: cube.entityId || createTrackId('su'),
        label,
        frameId: cube.frameId || 'map',
        color: cube.color,
        source,
        keyframes: [
          {
            timeNs,
            position: cube.position,
            orientation: cube.orientation,
            size: cube.size,
          },
        ],
      }
    })

    if (incoming.length === 0) return 0

    const existing = get(annotationTracksAtom)
    if (!replaceSameId) {
      const ids = new Set(existing.map((t) => t.id))
      const merged = [
        ...existing,
        ...incoming.map((t) =>
          ids.has(t.id) ? { ...t, id: createTrackId('su') } : t,
        ),
      ]
      set(annotationTracksAtom, merged)
      return incoming.length
    }

    const byId = new Map(existing.map((t) => [t.id, t]))
    for (const t of incoming) byId.set(t.id, t)
    set(annotationTracksAtom, [...byId.values()])
    return incoming.length
  },
)
