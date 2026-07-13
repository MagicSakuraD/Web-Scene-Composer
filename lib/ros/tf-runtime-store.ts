import { TF_WHEEL_CHILD_FRAMES, type TfWheelChildFrame } from '@/lib/ros/tf-config'

export interface RosTransform {
  translation: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

export interface TfEdge {
  parentFrame: string
  childFrame: string
  transform: RosTransform
  updatedAt: number
}

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

/** 最新 TF 边（child → parent + transform），高频更新，脱离 React */
class TfRuntimeStore {
  active = false
  private edges = new Map<string, TfEdge>()

  reset() {
    this.active = false
    this.edges.clear()
  }

  setActive(active: boolean) {
    this.active = active
    if (!active) this.edges.clear()
  }

  updateTransforms(
    transforms: Array<{
      parentFrame: string
      childFrame: string
      transform: RosTransform
    }>,
  ) {
    const now = performance.now()
    for (const t of transforms) {
      const child = normalizeFrameId(t.childFrame)
      if (!TF_WHEEL_CHILD_FRAMES.includes(child as TfWheelChildFrame)) continue
      this.edges.set(child, {
        parentFrame: normalizeFrameId(t.parentFrame),
        childFrame: child,
        transform: t.transform,
        updatedAt: now,
      })
    }
    if (this.edges.size > 0) this.active = true
  }

  getEdge(childFrame: string): TfEdge | undefined {
    return this.edges.get(normalizeFrameId(childFrame))
  }

  hasWheelData(): boolean {
    return this.edges.size > 0
  }
}

export const tfRuntimeStore = new TfRuntimeStore()
