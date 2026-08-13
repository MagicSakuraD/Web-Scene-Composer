import type { DecodedLaserScan } from '@/lib/foxglove/ros-serialization'

const MAX_LASER_POINTS = 8192

export interface LaserScanEntry {
  topic: string
  frameId: string
  pointCount: number
  /** Laser frame ROS xyz interleaved */
  positions: Float32Array
  generation: number
}

type Listener = () => void

class LaserScanStore {
  generation = 0
  private byTopic = new Map<string, LaserScanEntry>()
  private listeners = new Set<Listener>()

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    this.generation++
    for (const fn of this.listeners) fn()
  }

  setScan(topic: string, scan: DecodedLaserScan) {
    const n = Math.min(scan.pointCount, MAX_LASER_POINTS)
    let entry = this.byTopic.get(topic)
    if (!entry) {
      entry = {
        topic,
        frameId: scan.frameId,
        pointCount: n,
        positions: new Float32Array(MAX_LASER_POINTS * 3),
        generation: 0,
      }
      this.byTopic.set(topic, entry)
    }
    entry.frameId = scan.frameId
    entry.pointCount = n
    entry.positions.set(scan.positions.subarray(0, n * 3))
    entry.generation++
    this.emit()
  }

  get(topic: string): LaserScanEntry | undefined {
    return this.byTopic.get(topic)
  }

  getTopics(): string[] {
    return Array.from(this.byTopic.keys())
  }

  clearTopic(topic: string) {
    if (!this.byTopic.delete(topic)) return
    this.emit()
  }

  clearAll() {
    if (this.byTopic.size === 0) return
    this.byTopic.clear()
    this.emit()
  }
}

export const laserScanStore = new LaserScanStore()
export { MAX_LASER_POINTS as LASER_SCAN_MAX_POINTS }
