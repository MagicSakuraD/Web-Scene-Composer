import type { DecodedPointCloud } from '@/lib/foxglove/ros-serialization'
import { rosPointsToThreeBuffer } from '@/lib/ros/ros-three-coords'

export const LIDAR_MAX_POINTS = 100_000

/** 预分配 GPU 上传缓冲，避免每帧 new */
export const LIDAR_POSITION_BUFFER = new Float32Array(LIDAR_MAX_POINTS * 3)

type Listener = () => void

export interface LidarCloudSnapshot {
  topic: string
  pointCount: number
  frameId: string
  stampSec: number
  stampNanosec: number
  fps: number
  updatedAt: number
  generation: number
  /** Three.js Y 轴高度范围（Turbo 着色） */
  heightMin: number
  heightMax: number
  /** 到传感器距离范围（Distance 彩虹着色） */
  distMin: number
  distMax: number
}

const EMPTY_SNAPSHOT: LidarCloudSnapshot = {
  topic: '',
  pointCount: 0,
  frameId: '',
  stampSec: 0,
  stampNanosec: 0,
  fps: 0,
  updatedAt: 0,
  generation: 0,
  heightMin: 0,
  heightMax: 1,
  distMin: 0,
  distMax: 30,
}

/** 点云帧缓存 + generation 计数，供 useFrame 读取 */
class LidarPointStore {
  private listeners = new Set<Listener>()
  private fpsCounters = new Map<string, { count: number; windowStart: number }>()
  /** 稳定引用，供 useSyncExternalStore getSnapshot */
  private snapshot: LidarCloudSnapshot = { ...EMPTY_SNAPSHOT }

  generation = 0
  pointCount = 0
  topic = ''
  frameId = ''
  stampSec = 0
  stampNanosec = 0
  fps = 0
  updatedAt = 0
  heightMin = 0
  heightMax = 1
  distMin = 0
  distMax = 30

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** 始终返回同一对象引用（React 19 useSyncExternalStore 要求） */
  getSnapshot(): LidarCloudSnapshot {
    return this.snapshot
  }

  private syncSnapshot() {
    const s = this.snapshot
    s.topic = this.topic
    s.pointCount = this.pointCount
    s.frameId = this.frameId
    s.stampSec = this.stampSec
    s.stampNanosec = this.stampNanosec
    s.fps = this.fps
    s.updatedAt = this.updatedAt
    s.generation = this.generation
    s.heightMin = this.heightMin
    s.heightMax = this.heightMax
    s.distMin = this.distMin
    s.distMax = this.distMax
  }

  setCloud(topic: string, cloud: DecodedPointCloud) {
    const count = Math.min(cloud.pointCount, LIDAR_MAX_POINTS)
    const { minY, maxY } = rosPointsToThreeBuffer(cloud.positions, LIDAR_POSITION_BUFFER, count)
    const { minD, maxD } = computeDistanceRange(LIDAR_POSITION_BUFFER, count)

    const now = performance.now()
    const counter = this.fpsCounters.get(topic) ?? { count: 0, windowStart: now }
    counter.count += 1
    let fps = this.fps
    if (now - counter.windowStart >= 1000) {
      fps = counter.count / ((now - counter.windowStart) / 1000)
      counter.count = 0
      counter.windowStart = now
    }
    this.fpsCounters.set(topic, counter)

    this.topic = topic
    this.pointCount = count
    this.frameId = cloud.frameId
    this.stampSec = cloud.stampSec
    this.stampNanosec = cloud.stampNanosec
    this.fps = fps
    this.updatedAt = now
    this.heightMin = minY
    this.heightMax = maxY
    this.distMin = minD
    this.distMax = maxD
    this.generation += 1
    this.syncSnapshot()
    this.listeners.forEach((l) => l())
  }

  clearAll() {
    this.pointCount = 0
    this.topic = ''
    this.frameId = ''
    this.fps = 0
    this.heightMin = 0
    this.heightMax = 1
    this.distMin = 0
    this.distMax = 30
    this.generation += 1
    this.fpsCounters.clear()
    this.syncSnapshot()
    this.listeners.forEach((l) => l())
  }
}

function computeDistanceRange(
  buf: Float32Array,
  pointCount: number,
): { minD: number; maxD: number } {
  let minD = Infinity
  let maxD = -Infinity
  const n = pointCount * 3
  for (let i = 0; i < n; i += 3) {
    const x = buf[i]
    const y = buf[i + 1]
    const z = buf[i + 2]
    const d = Math.sqrt(x * x + y * y + z * z)
    if (d < minD) minD = d
    if (d > maxD) maxD = d
  }
  if (!Number.isFinite(minD)) minD = 0
  if (!Number.isFinite(maxD) || maxD <= minD) maxD = minD + 1
  return { minD, maxD }
}

export const lidarPointStore = new LidarPointStore()
