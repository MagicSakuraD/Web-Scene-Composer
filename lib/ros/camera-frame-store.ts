import type { DecodedCameraFrame } from '@/lib/foxglove/ros-serialization'

/** 给 UI 元数据用；真正的像素走 registerCanvas 同步绘制，不把 ImageBitmap 交给 React */
export interface CameraFrameSnapshot {
  topic: string
  width: number
  height: number
  encoding: string
  stampSec: number
  stampNanosec: number
  frameId: string
  generation: number
  fps: number
  updatedAt: number
  /** 仅表示是否已有画面（不持有 ImageBitmap 引用） */
  hasImage: boolean
}

type Listener = () => void

function paintCanvas(canvas: HTMLCanvasElement, bitmap: ImageBitmap) {
  if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  try {
    ctx.drawImage(bitmap, 0, 0)
  } catch {
    /* bitmap 已 detach —— 忽略本帧 */
  }
}

/**
 * 摄像头帧缓存。
 * 多路话题各自独立；绘制必须在 close(bitmap) 之前同步完成。
 */
class CameraFrameStore {
  private meta = new Map<string, CameraFrameSnapshot>()
  private listeners = new Set<Listener>()
  private fpsCounters = new Map<string, { count: number; windowStart: number }>()
  private generations = new Map<string, number>()
  /** topic → 已挂载的 canvas（可多个副本预览同一话题） */
  private canvases = new Map<string, Set<HTMLCanvasElement>>()
  /** 上一帧 bitmap，下一帧成功绘制后再 close */
  private lastBitmaps = new Map<string, ImageBitmap>()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getFrame(topic: string): CameraFrameSnapshot | undefined {
    return this.meta.get(topic)
  }

  getTopics(): string[] {
    return [...this.meta.keys()]
  }

  /**
   * 注册 canvas：新帧到后直接画进 canvas，绕过 React useEffect 竞态。
   */
  registerCanvas(topic: string, canvas: HTMLCanvasElement) {
    let set = this.canvases.get(topic)
    if (!set) {
      set = new Set()
      this.canvases.set(topic, set)
    }
    set.add(canvas)

    const existing = this.lastBitmaps.get(topic)
    if (existing) paintCanvas(canvas, existing)

    return () => {
      set!.delete(canvas)
      if (set!.size === 0) this.canvases.delete(topic)
    }
  }

  setFrame(topic: string, frame: DecodedCameraFrame) {
    const now = performance.now()
    let fps = this.meta.get(topic)?.fps ?? 0
    const counter = this.fpsCounters.get(topic) ?? { count: 0, windowStart: now }
    counter.count += 1
    if (now - counter.windowStart >= 1000) {
      fps = counter.count / ((now - counter.windowStart) / 1000)
      counter.count = 0
      counter.windowStart = now
    }
    this.fpsCounters.set(topic, counter)

    const generation = (this.generations.get(topic) ?? 0) + 1
    this.generations.set(topic, generation)

    // 1) 先画到所有已注册 canvas
    const targets = this.canvases.get(topic)
    if (targets) {
      for (const canvas of targets) {
        paintCanvas(canvas, frame.bitmap)
      }
    }

    // 2) 再替换并关闭旧 bitmap（此时 canvas 里已是像素拷贝）
    const prevBitmap = this.lastBitmaps.get(topic)
    this.lastBitmaps.set(topic, frame.bitmap)
    if (prevBitmap && prevBitmap !== frame.bitmap) {
      prevBitmap.close()
    }

    this.meta.set(topic, {
      topic,
      width: frame.width,
      height: frame.height,
      encoding: frame.encoding,
      stampSec: frame.stampSec,
      stampNanosec: frame.stampNanosec,
      frameId: frame.frameId,
      generation,
      fps,
      updatedAt: now,
      hasImage: true,
    })
    this.listeners.forEach((l) => l())
  }

  clearTopic(topic: string) {
    const prev = this.lastBitmaps.get(topic)
    if (prev) prev.close()
    this.lastBitmaps.delete(topic)
    this.meta.delete(topic)
    this.fpsCounters.delete(topic)
    this.generations.delete(topic)
    this.listeners.forEach((l) => l())
  }

  clearAll() {
    for (const bitmap of this.lastBitmaps.values()) {
      bitmap.close()
    }
    this.lastBitmaps.clear()
    this.meta.clear()
    this.fpsCounters.clear()
    this.generations.clear()
    this.listeners.forEach((l) => l())
  }
}

export const cameraFrameStore = new CameraFrameStore()
