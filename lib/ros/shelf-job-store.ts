import { jobPhaseNameFromCode } from '@/lib/ros/shelf-job-config'
import type { DecodedJobStatus } from '@/lib/foxglove/ros-serialization'

export type ShelfJobListener = () => void

export interface ShelfJobSnapshot {
  servicesReady: boolean
  subscribed: boolean
  sending: boolean
  lastCallMessage: string | null
  phase: number
  phaseName: string
  message: string
  errorCode: number
  childErrorCode: number
  progress: number
}

class ShelfJobStore {
  private listeners = new Set<ShelfJobListener>()
  private snapshot: ShelfJobSnapshot
  servicesReady = false
  subscribed = false
  sending = false
  lastCallMessage: string | null = null
  phase = 0
  phaseName = 'IDLE'
  message = ''
  errorCode = 0
  childErrorCode = 0
  progress = 0

  constructor() {
    this.snapshot = this.buildSnapshot()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): ShelfJobSnapshot {
    return this.snapshot
  }

  private buildSnapshot(): ShelfJobSnapshot {
    return {
      servicesReady: this.servicesReady,
      subscribed: this.subscribed,
      sending: this.sending,
      lastCallMessage: this.lastCallMessage,
      phase: this.phase,
      phaseName: this.phaseName,
      message: this.message,
      errorCode: this.errorCode,
      childErrorCode: this.childErrorCode,
      progress: this.progress,
    }
  }

  private emit() {
    this.snapshot = this.buildSnapshot()
    for (const fn of this.listeners) fn()
  }

  setServicesReady(ready: boolean) {
    if (this.servicesReady === ready) return
    this.servicesReady = ready
    this.emit()
  }

  setSubscribed(subscribed: boolean) {
    if (this.subscribed === subscribed) return
    this.subscribed = subscribed
    this.emit()
  }

  beginStart(message = '正在启动作业…') {
    this.sending = true
    this.lastCallMessage = message
    this.phase = 0
    this.phaseName = 'IDLE'
    this.message = ''
    this.errorCode = 0
    this.childErrorCode = 0
    this.progress = 0
    this.emit()
  }

  applyStartResponse(accepted: boolean, message: string) {
    this.sending = false
    this.lastCallMessage = message
    if (!accepted) {
      this.phase = 6
      this.phaseName = 'FAILED'
      this.message = message
    }
    // accepted 只表示 /job/start 收下请求；阶段/进度/错误码以 /job/status 为准
    this.emit()
  }

  setMessage(message: string) {
    this.lastCallMessage = message
    this.emit()
  }

  applyStatus(status: DecodedJobStatus) {
    this.sending = false
    this.phase = status.phase
    this.phaseName = status.phaseName || jobPhaseNameFromCode(status.phase) || 'IDLE'
    this.message = status.message
    this.errorCode = status.errorCode
    this.childErrorCode = status.childErrorCode
    this.progress = status.progress
    this.emit()
  }

  setFailed(message: string) {
    this.sending = false
    this.phase = 6
    this.phaseName = 'FAILED'
    this.message = message
    this.lastCallMessage = message
    this.emit()
  }

  reset() {
    this.servicesReady = false
    this.subscribed = false
    this.sending = false
    this.lastCallMessage = null
    this.phase = 0
    this.phaseName = 'IDLE'
    this.message = ''
    this.errorCode = 0
    this.childErrorCode = 0
    this.progress = 0
    this.emit()
  }
}

export const shelfJobStore = new ShelfJobStore()
