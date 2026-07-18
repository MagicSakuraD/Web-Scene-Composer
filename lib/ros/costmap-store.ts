import type { DecodedOccupancyGrid } from '@/lib/foxglove/ros-serialization'
import { GLOBAL_COSTMAP_TOPIC, LOCAL_COSTMAP_TOPIC } from '@/lib/ros/nav-goal-config'

type Listener = () => void

export type CostmapKind = 'local' | 'global'

export interface CostmapSnapshot {
  kind: CostmapKind
  topic: string
  visible: boolean
  subscribed: boolean
  hasData: boolean
  frameId: string
  resolution: number
  width: number
  height: number
  generation: number
  updatedAt: number
}

class CostmapStore {
  readonly kind: CostmapKind
  readonly topic: string
  visible = false
  subscribed = false
  frameId = ''
  resolution = 0
  width = 0
  height = 0
  generation = 0
  updatedAt = 0
  origin = {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  }
  /** row-major occupancy cells */
  data: Int8Array | null = null

  private snapshot: CostmapSnapshot
  private listeners = new Set<Listener>()
  /** Foxglove 订阅开关变化回调（由 client-manager 注册） */
  private visibilityHandlers = new Set<(visible: boolean) => void>()

  constructor(kind: CostmapKind, topic: string) {
    this.kind = kind
    this.topic = topic
    this.snapshot = this.buildSnapshot()
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  onVisibilityChange(handler: (visible: boolean) => void): () => void {
    this.visibilityHandlers.add(handler)
    return () => this.visibilityHandlers.delete(handler)
  }

  getSnapshot(): CostmapSnapshot {
    return this.snapshot
  }

  private buildSnapshot(): CostmapSnapshot {
    return {
      kind: this.kind,
      topic: this.topic,
      visible: this.visible,
      subscribed: this.subscribed,
      hasData: this.data != null && this.width > 0 && this.height > 0,
      frameId: this.frameId,
      resolution: this.resolution,
      width: this.width,
      height: this.height,
      generation: this.generation,
      updatedAt: this.updatedAt,
    }
  }

  private publish() {
    this.snapshot = this.buildSnapshot()
    for (const l of this.listeners) l()
  }

  setVisible(visible: boolean) {
    if (this.visible === visible) return
    this.visible = visible
    if (!visible) {
      this.clearGrid()
    }
    this.publish()
    for (const h of this.visibilityHandlers) h(visible)
  }

  setSubscribed(subscribed: boolean) {
    if (this.subscribed === subscribed) return
    this.subscribed = subscribed
    this.publish()
  }

  setGrid(grid: DecodedOccupancyGrid) {
    if (!this.visible) return
    this.frameId = grid.frameId
    this.resolution = grid.resolution
    this.width = grid.width
    this.height = grid.height
    this.origin = {
      position: { ...grid.origin.position },
      orientation: { ...grid.origin.orientation },
    }
    // copy so subsequent CDR buffers can be reused
    this.data = new Int8Array(grid.data)
    this.generation++
    this.updatedAt = performance.now()
    this.publish()
  }

  clearGrid() {
    this.frameId = ''
    this.resolution = 0
    this.width = 0
    this.height = 0
    this.data = null
    this.generation++
    this.updatedAt = performance.now()
    this.publish()
  }

  reset() {
    this.visible = false
    this.subscribed = false
    this.clearGrid()
    this.publish()
  }
}

export const localCostmapStore = new CostmapStore('local', LOCAL_COSTMAP_TOPIC)
export const globalCostmapStore = new CostmapStore('global', GLOBAL_COSTMAP_TOPIC)

/** 便于 client-manager 统一遍历订阅/退订 */
export const costmapStores: CostmapStore[] = [localCostmapStore, globalCostmapStore]

export function costmapStoreByTopic(topic: string): CostmapStore | undefined {
  return costmapStores.find((s) => s.topic === topic)
}

export type { CostmapStore }
