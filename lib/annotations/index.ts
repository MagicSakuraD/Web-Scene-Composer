/**
 * Unit-free helpers for annotation sampling (no React).
 * Kept separate so Node/scripts can reuse without jotai.
 */
export {
  sampleTrackAt,
  sampleTracksAt,
  sortKeyframes,
  trackLifetimeNs,
  createTrackId,
} from '@/lib/annotations/types'
