import type { BehaviorTreeStatusChange } from '@/lib/foxglove/ros-serialization'
import {
  classifyBtNode,
  formatBtNodeLabel,
  isInterestingBtNode,
  normalizeBtStatus,
} from '@/lib/ros/bt-node-classify'

export type BtNodeStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | 'UNKNOWN'
export type BtNodeCategory = 'planning' | 'control' | 'recovery' | 'condition' | 'other'

export interface BtTimelineSegment {
  id: string
  nodeName: string
  label: string
  uid: number
  category: BtNodeCategory
  status: BtNodeStatus
  startMs: number
  endMs: number | null
}

export interface BtTimelineEvent {
  id: string
  atMs: number
  nodeName: string
  label: string
  category: BtNodeCategory
  previousStatus: BtNodeStatus
  currentStatus: BtNodeStatus
}

export interface BtHudSnapshot {
  message: string | null
  tone: 'info' | 'warn' | 'error'
}

export interface BtTimelineSnapshot {
  subscribed: boolean
  missionStartMs: number | null
  segments: readonly BtTimelineSegment[]
  events: readonly BtTimelineEvent[]
  activeNodes: readonly string[]
  recoveryCount: number
  hud: BtHudSnapshot
}

type Listener = () => void

const MAX_SEGMENTS = 240
const MAX_EVENTS = 80
let nextId = 1

function segmentKey(uid: number, nodeName: string) {
  return `${uid}:${nodeName}`
}

class BtTimelineStore {
  private listeners = new Set<Listener>()
  private hudListeners = new Set<Listener>()
  subscribed = false
  missionStartMs: number | null = null
  segments: BtTimelineSegment[] = []
  events: BtTimelineEvent[] = []
  activeRunning = new Map<string, BtTimelineSegment>()
  activeNodeLabels = new Set<string>()
  recoveryCount = 0
  hud: BtHudSnapshot = { message: null, tone: 'info' }

  /** useSyncExternalStore 要求 getSnapshot 引用在“无变化”时保持稳定 */
  private snapshot: BtTimelineSnapshot = {
    subscribed: false,
    missionStartMs: null,
    segments: [],
    events: [],
    activeNodes: [],
    recoveryCount: 0,
    hud: { message: null, tone: 'info' },
  }
  private hudSnapshot: BtHudSnapshot = { message: null, tone: 'info' }

  subscribe(fn: Listener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  subscribeHud(fn: Listener) {
    this.hudListeners.add(fn)
    return () => this.hudListeners.delete(fn)
  }

  getSnapshot(): BtTimelineSnapshot {
    return this.snapshot
  }

  getHudSnapshot(): BtHudSnapshot {
    return this.hudSnapshot
  }

  private emit() {
    this.snapshot = {
      subscribed: this.subscribed,
      missionStartMs: this.missionStartMs,
      segments: this.segments,
      events: this.events,
      activeNodes: Array.from(this.activeNodeLabels),
      recoveryCount: this.recoveryCount,
      hud: this.hud,
    }
    for (const fn of this.listeners) fn()
  }

  private emitHud() {
    this.hudSnapshot = this.hud
    for (const fn of this.hudListeners) fn()
  }

  setSubscribed(active: boolean) {
    if (this.subscribed === active) return
    this.subscribed = active
    this.emit()
  }

  beginMission() {
    this.reset()
    this.missionStartMs = performance.now()
    this.emit()
  }

  reset() {
    this.missionStartMs = null
    this.segments = []
    this.events = []
    this.activeRunning.clear()
    this.activeNodeLabels.clear()
    this.recoveryCount = 0
    this.hud = { message: null, tone: 'info' }
    this.emit()
    this.emitHud()
  }

  applyStatusChanges(changes: BehaviorTreeStatusChange[]) {
    if (!changes.length) return
    const now = performance.now()
    if (this.missionStartMs == null) this.missionStartMs = now

    let changed = false
    let hudChanged = false

    for (const change of changes) {
      const prev = normalizeBtStatus(change.previousStatus)
      const curr = normalizeBtStatus(change.currentStatus)
      if (prev === curr) continue
      if (!isInterestingBtNode(change.nodeName) && curr === 'IDLE') continue

      const category = classifyBtNode(change.nodeName)
      const label = formatBtNodeLabel(change.nodeName)
      const key = segmentKey(change.uid, change.nodeName)

      this.events.push({
        id: `evt-${nextId++}`,
        atMs: now,
        nodeName: change.nodeName,
        label,
        category,
        previousStatus: prev,
        currentStatus: curr,
      })
      if (this.events.length > MAX_EVENTS) {
        this.events.splice(0, this.events.length - MAX_EVENTS)
      }
      changed = true

      if (prev === 'RUNNING' && curr !== 'RUNNING') {
        const open = this.activeRunning.get(key)
        if (open) {
          open.endMs = now
          open.status = curr
          this.activeRunning.delete(key)
        }
        this.activeNodeLabels.delete(label)
      }

      if (curr === 'RUNNING') {
        const seg: BtTimelineSegment = {
          id: `seg-${nextId++}`,
          nodeName: change.nodeName,
          label,
          uid: change.uid,
          category,
          status: 'RUNNING',
          startMs: now,
          endMs: null,
        }
        this.segments.push(seg)
        if (this.segments.length > MAX_SEGMENTS) {
          this.segments.splice(0, this.segments.length - MAX_SEGMENTS)
        }
        this.activeRunning.set(key, seg)
        this.activeNodeLabels.add(label)
      }

      if (category === 'recovery' && curr === 'RUNNING') {
        this.recoveryCount += 1
        this.hud = { message: `Nav2 Recovery: ${label}`, tone: 'warn' }
        hudChanged = true
      } else if (category === 'recovery' && curr === 'FAILURE') {
        this.hud = { message: `Recovery failed: ${label}`, tone: 'error' }
        hudChanged = true
      } else if (category === 'recovery' && curr === 'SUCCESS') {
        if (this.hud.tone === 'warn' && this.hud.message?.includes(label)) {
          this.hud = { message: null, tone: 'info' }
          hudChanged = true
        }
      } else if (curr === 'RUNNING' && category === 'control') {
        this.hud = { message: null, tone: 'info' }
        hudChanged = true
      }
    }

    if (changed) this.emit()
    if (hudChanged) this.emitHud()
  }
}

export const btTimelineStore = new BtTimelineStore()
