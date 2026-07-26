/**
 * Editable annotation layer (ROS coordinates).
 * Distinct from readonly foxglove.SceneUpdate in sceneEntityStore.
 */

export type AnnotationSource = 'manual' | 'scene-update' | 'import'

/** One pose/size sample on a track (ROS / map frame). */
export interface AnnotationKeyframe {
  timeNs: bigint
  position: [number, number, number]
  /** Quaternion xyzw */
  orientation: [number, number, number, number]
  size: [number, number, number]
}

/**
 * One labeled object over time.
 * Viewport samples with step hold: nearest keyframe with timeNs <= t.
 */
export interface AnnotationTrack {
  id: string
  label: string
  frameId: string
  color: [number, number, number, number]
  source: AnnotationSource
  keyframes: AnnotationKeyframe[]
}

/** Sampled box for rendering / gizmo at a clock time */
export interface SampledAnnotationBox {
  trackId: string
  label: string
  frameId: string
  color: [number, number, number, number]
  source: AnnotationSource
  timeNs: bigint
  position: [number, number, number]
  orientation: [number, number, number, number]
  size: [number, number, number]
  /** Index into track.keyframes */
  keyframeIndex: number
}

export const DEFAULT_BOX_SIZE: [number, number, number] = [4, 1.8, 1.5]
export const DEFAULT_BOX_COLOR: [number, number, number, number] = [1, 0.62, 0, 0.5]
export const DEFAULT_BOX_ORIENTATION: [number, number, number, number] = [0, 0, 0, 1]

export function createTrackId(prefix = 'ann'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** Sort keyframes ascending by time (mutates copy). */
export function sortKeyframes(keyframes: AnnotationKeyframe[]): AnnotationKeyframe[] {
  return [...keyframes].sort((a, b) => (a.timeNs < b.timeNs ? -1 : a.timeNs > b.timeNs ? 1 : 0))
}

/**
 * Step-hold sample: latest keyframe with timeNs <= t.
 * If t is before the first keyframe, returns null (track not yet alive).
 */
export function sampleTrackAt(
  track: AnnotationTrack,
  timeNs: bigint,
): SampledAnnotationBox | null {
  const kfs = track.keyframes
  if (kfs.length === 0) return null

  let bestIdx = -1
  for (let i = 0; i < kfs.length; i++) {
    if (kfs[i].timeNs <= timeNs) bestIdx = i
    else break
  }
  if (bestIdx < 0) return null

  const kf = kfs[bestIdx]
  return {
    trackId: track.id,
    label: track.label,
    frameId: track.frameId,
    color: track.color,
    source: track.source,
    timeNs: kf.timeNs,
    position: kf.position,
    orientation: kf.orientation,
    size: kf.size,
    keyframeIndex: bestIdx,
  }
}

export function sampleTracksAt(
  tracks: AnnotationTrack[],
  timeNs: bigint,
): SampledAnnotationBox[] {
  const out: SampledAnnotationBox[] = []
  for (const track of tracks) {
    const sampled = sampleTrackAt(track, timeNs)
    if (sampled) out.push(sampled)
  }
  return out
}

/** Inclusive lifetime of a track from first to last keyframe. */
export function trackLifetimeNs(
  track: AnnotationTrack,
): { startNs: bigint; endNs: bigint } | null {
  if (track.keyframes.length === 0) return null
  const first = track.keyframes[0].timeNs
  const last = track.keyframes[track.keyframes.length - 1].timeNs
  return { startNs: first, endNs: last }
}
