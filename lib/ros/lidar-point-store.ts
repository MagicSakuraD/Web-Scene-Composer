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
  /** Three.js Y 轴高度范围（Turbo 着色器用） */
  heightMin: number
  heightMax: number
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
  }

  setCloud(topic: string, cloud: DecodedPointCloud) {
    const count = Math.min(cloud.pointCount, LIDAR_MAX_POINTS)
    const { minY, maxY } = rosPointsToThreeBuffer(cloud.positions, LIDAR_POSITION_BUFFER, count)

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
    this.generation += 1
    this.fpsCounters.clear()
    this.syncSnapshot()
    this.listeners.forEach((l) => l())
  }
}

export const lidarPointStore = new LidarPointStore()
