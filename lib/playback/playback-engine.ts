import { getDefaultStore } from 'jotai'
import {
  playbackTimeNsAtom,
  playbackRangeAtom,
  playbackPlayingAtom,
  playbackRateAtom,
} from '@/lib/playback/atoms'
import { mcapReplayController } from '@/lib/mcap/mcap-replay-controller'

class PlaybackEngine {
  private rafId: number | null = null
  private lastWallMs = 0

  play() {
    const store = getDefaultStore()
    if (!mcapReplayController.isLoaded) return
    if (store.get(playbackPlayingAtom)) return
    store.set(playbackPlayingAtom, true)
    this.lastWallMs = performance.now()
    this.tick()
  }

  pause() {
    const store = getDefaultStore()
    store.set(playbackPlayingAtom, false)
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  async seek(timeNs: bigint) {
    const store = getDefaultStore()
    const range = store.get(playbackRangeAtom)
    if (!range) return

    const clamped =
      timeNs < range.startNs ? range.startNs : timeNs > range.endNs ? range.endNs : timeNs

    store.set(playbackTimeNsAtom, clamped)
    await mcapReplayController.seek(clamped)
  }

  async stepFrame(deltaMs: number) {
    const store = getDefaultStore()
    const range = store.get(playbackRangeAtom)
    if (!range) return

    const stepNs = BigInt(Math.round(deltaMs * 1_000_000))
    const current = store.get(playbackTimeNsAtom)
    const next = current + stepNs
    const clamped = next < range.startNs ? range.startNs : next > range.endNs ? range.endNs : next
    this.pause()
    await this.seek(clamped)
  }

  private tick = () => {
    const store = getDefaultStore()
    if (!store.get(playbackPlayingAtom)) return

    const now = performance.now()
    const deltaMs = now - this.lastWallMs
    this.lastWallMs = now

    const range = store.get(playbackRangeAtom)
    if (!range) {
      this.pause()
      return
    }

    const rate = store.get(playbackRateAtom)
    const deltaNs = BigInt(Math.round(deltaMs * rate * 1_000_000))
    const current = store.get(playbackTimeNsAtom)
    const next = current + deltaNs

    if (next >= range.endNs) {
      store.set(playbackTimeNsAtom, range.endNs)
      void mcapReplayController.flushToTime(range.endNs).then(() => this.pause())
      return
    }

    store.set(playbackTimeNsAtom, next)
    void mcapReplayController.flushToTime(next).then(() => {
      if (store.get(playbackPlayingAtom)) {
        this.rafId = requestAnimationFrame(this.tick)
      }
    })
  }
}

export const playbackEngine = new PlaybackEngine()
