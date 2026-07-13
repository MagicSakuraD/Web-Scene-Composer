import type { DecodedNavPath } from '@/lib/foxglove/ros-serialization'
import { fillScenePathPositions, normalizeRosFrameId } from '@/lib/ros/nav-path-transform'
import {
  LOCAL_PLAN_TOPIC,
  PLAN_SMOOTHED_TOPIC,
  PLAN_TOPIC,
} from '@/lib/ros/nav-goal-config'

export const NAV_PATH_MAX_POSES = 4096

type Listener = () => void

export interface NavPathLayerSnapshot {
  topic: string
  frameId: string
  poseCount: number
  generation: number
  updatedAt: number
  /** 是否需要每帧重算（odom / base_link 依赖小车校准） */
  needsLiveTransform: boolean
}

const EMPTY_LAYER: NavPathLayerSnapshot = {
  topic: '',
  frameId: '',
  poseCount: 0,
  generation: 0,
  updatedAt: 0,
  needsLiveTransform: false,
}

function frameNeedsLiveTransform(frameId: string): boolean {
  const f = normalizeRosFrameId(frameId)
  return f === 'odom' || f === 'base_link' || f === 'base_footprint'
}

class NavPathLayer {
  topic = ''
  frameId = ''
  poseCount = 0
  generation = 0
  updatedAt = 0
  needsLiveTransform = false
  /** 原始 ROS 坐标 */
  rosPositions = new Float32Array(NAV_PATH_MAX_POSES * 3)
  /** Three.js 场景坐标 */
  positions = new Float32Array(NAV_PATH_MAX_POSES * 3)
  private snapshot: NavPathLayerSnapshot = { ...EMPTY_LAYER }

  getSnapshot(): NavPathLayerSnapshot {
    return this.snapshot
  }

  private publishSnapshot() {
    this.snapshot = {
      topic: this.topic,
      frameId: this.frameId,
      poseCount: this.poseCount,
      generation: this.generation,
      updatedAt: this.updatedAt,
      needsLiveTransform: this.needsLiveTransform,
    }
  }

  /** 按 frame_id 重算显示坐标；校准就绪后 local plan 才会对齐小车 */
  recomputeDisplay(): boolean {
    if (this.poseCount < 2) return false
    fillScenePathPositions(this.rosPositions, this.poseCount, this.frameId, this.positions)
    this.generation++
    this.updatedAt = performance.now()
    this.publishSnapshot()
    return true
  }

  setPath(topic: string, path: DecodedNavPath) {
    const n = Math.min(path.poses.length, NAV_PATH_MAX_POSES)
    if (n < 2) {
      this.clear()
      return
    }

    for (let i = 0; i < n; i++) {
      const p = path.poses[i]
      const o = i * 3
      this.rosPositions[o] = p.x
      this.rosPositions[o + 1] = p.y
      this.rosPositions[o + 2] = p.z
    }

    this.topic = topic
    this.frameId = path.frameId
    this.poseCount = n
    this.needsLiveTransform = frameNeedsLiveTransform(path.frameId)
    this.recomputeDisplay()
  }

  clear() {
    if (this.poseCount === 0 && !this.topic) return
    this.topic = ''
    this.frameId = ''
    this.poseCount = 0
    this.needsLiveTransform = false
    this.generation++
    this.updatedAt = 0
    this.publishSnapshot()
  }
}

/**
 * Nav2 路径缓存。
 * global：优先 /plan_smoothed，否则 /plan（通常 map 系）
 * local：/local_plan（通常 odom 系，非相对坐标）
 */
class NavPathStore {
  private listeners = new Set<Listener>()

  readonly globalPlan = new NavPathLayer()
  readonly localPlan = new NavPathLayer()
  /** @deprecated 别名，面板兼容 */
  get planSmoothed() {
    return this.globalPlan
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const fn of this.listeners) fn()
  }

  setPath(topic: string, path: DecodedNavPath) {
    if (topic === PLAN_SMOOTHED_TOPIC) {
      this.globalPlan.setPath(topic, path)
    } else if (topic === PLAN_TOPIC) {
      const cur = this.globalPlan.topic
      if (cur === '' || cur === PLAN_TOPIC) {
        this.globalPlan.setPath(topic, path)
      }
    } else if (topic === LOCAL_PLAN_TOPIC) {
      this.localPlan.setPath(topic, path)
    } else {
      return
    }
    this.emit()
  }

  reset() {
    this.globalPlan.clear()
    this.localPlan.clear()
    this.emit()
  }
}

export const navPathStore = new NavPathStore()
