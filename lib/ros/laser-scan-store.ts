import type { DecodedLaserScan } from '@/lib/foxglove/ros-serialization'

const MAX_LASER_POINTS = 8192

export interface LaserScanEntry {
  topic: string
  frameId: string
  pointCount: number
  /** Laser frame ROS xyz interleaved */
  positions: Float32Array
  /** 本帧有效距离范围（TSL 彩虹着色） */
  distMin: number
  distMax: number
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
        distMin: 0,
        distMax: 30,
        generation: 0,
      }
      this.byTopic.set(topic, entry)
    }
    entry.frameId = scan.frameId
    entry.pointCount = n
    entry.positions.set(scan.positions.subarray(0, n * 3))
    const { minD, maxD } = scanDistanceRange(entry.positions, n, scan.rangeMin, scan.rangeMax)
    entry.distMin = minD
    entry.distMax = maxD
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

function scanDistanceRange(
  positions: Float32Array,
  pointCount: number,
  rangeMin: number,
  rangeMax: number,
): { minD: number; maxD: number } {
  let minD = Infinity
  let maxD = -Infinity
  const n = pointCount * 3
  for (let i = 0; i < n; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    const d = Math.sqrt(x * x + y * y)
    if (d < minD) minD = d
    if (d > maxD) maxD = d
  }
  if (!Number.isFinite(minD)) {
    minD = Number.isFinite(rangeMin) ? rangeMin : 0
  }
  if (!Number.isFinite(maxD) || maxD <= minD) {
    maxD = Number.isFinite(rangeMax) && rangeMax > minD ? rangeMax : minD + 1
  }
  return { minD, maxD }
}

export const laserScanStore = new LaserScanStore()
export { MAX_LASER_POINTS as LASER_SCAN_MAX_POINTS }
