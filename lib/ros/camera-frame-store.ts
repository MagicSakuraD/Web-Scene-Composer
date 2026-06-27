import type { DecodedCameraFrame } from '@/lib/foxglove/ros-serialization'

export interface CameraFrameSnapshot {
  topic: string
  width: number
  height: number
  encoding: string
  stampSec: number
  stampNanosec: number
  frameId: string
  blobUrl: string | null
  fps: number
  updatedAt: number
}

type Listener = () => void

/** 摄像头帧缓存，脱离 React 高频渲染 */
class CameraFrameStore {
  private frames = new Map<string, CameraFrameSnapshot>()
  private listeners = new Set<Listener>()
  private fpsCounters = new Map<string, { count: number; windowStart: number }>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getFrame(topic: string): CameraFrameSnapshot | undefined {
    return this.frames.get(topic)
  }

  getTopics(): string[] {
    return [...this.frames.keys()]
  }

  setFrame(topic: string, frame: DecodedCameraFrame) {
    const prev = this.frames.get(topic)
    if (prev?.blobUrl && prev.blobUrl !== frame.blobUrl) {
      URL.revokeObjectURL(prev.blobUrl)
    }

    const now = performance.now()
    let fps = prev?.fps ?? 0
    const counter = this.fpsCounters.get(topic) ?? { count: 0, windowStart: now }
    counter.count += 1
    if (now - counter.windowStart >= 1000) {
      fps = counter.count / ((now - counter.windowStart) / 1000)
      counter.count = 0
      counter.windowStart = now
    }
    this.fpsCounters.set(topic, counter)

    this.frames.set(topic, {
      topic,
      width: frame.width,
      height: frame.height,
      encoding: frame.encoding,
      stampSec: frame.stampSec,
      stampNanosec: frame.stampNanosec,
      frameId: frame.frameId,
      blobUrl: frame.blobUrl,
      fps,
      updatedAt: now,
    })
    this.listeners.forEach((l) => l())
  }

  clearTopic(topic: string) {
    const prev = this.frames.get(topic)
    if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
    this.frames.delete(topic)
    this.fpsCounters.delete(topic)
    this.listeners.forEach((l) => l())
  }

  clearAll() {
    for (const frame of this.frames.values()) {
      if (frame.blobUrl) URL.revokeObjectURL(frame.blobUrl)
    }
    this.frames.clear()
    this.fpsCounters.clear()
    this.listeners.forEach((l) => l())
  }
}

export const cameraFrameStore = new CameraFrameStore()
