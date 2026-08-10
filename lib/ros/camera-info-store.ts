export interface DecodedCameraInfo {
  topic: string
  frameId: string
  width: number
  height: number
  /** row-major 3×3: fx, 0, cx, 0, fy, cy, 0, 0, 1 */
  K: Float64Array
  D: Float64Array
  distortionModel: string
}

type Listener = () => void

class CameraInfoStore {
  private byTopic = new Map<string, DecodedCameraInfo>()
  private listeners = new Set<Listener>()
  generation = 0

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit() {
    this.generation++
    for (const fn of this.listeners) fn()
  }

  set(info: DecodedCameraInfo) {
    this.byTopic.set(info.topic, info)
    this.emit()
  }

  get(topic: string): DecodedCameraInfo | undefined {
    return this.byTopic.get(topic)
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

export const cameraInfoStore = new CameraInfoStore()
