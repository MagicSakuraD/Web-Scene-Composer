import type { NavGoalPhase } from '@/lib/ros/atoms'
import type { NavGoalFeedback } from '@/lib/foxglove/ros-serialization'
import { GOAL_STATUS } from '@/lib/foxglove/ros-serialization'

export type NavGoalListener = (state: {
  phase: NavGoalPhase
  distanceRemaining: number | null
  goalStatus: number | null
  lastMessage: string | null
  servicesReady: boolean
}) => void

class NavGoalStore {
  private listeners = new Set<NavGoalListener>()
  phase: NavGoalPhase = 'idle'
  distanceRemaining: number | null = null
  goalStatus: number | null = null
  lastMessage: string | null = null
  servicesReady = false

  subscribe(fn: NavGoalListener) {
    this.listeners.add(fn)
    fn(this.getSnapshot())
    return () => this.listeners.delete(fn)
  }

  getSnapshot() {
    return {
      phase: this.phase,
      distanceRemaining: this.distanceRemaining,
      goalStatus: this.goalStatus,
      lastMessage: this.lastMessage,
      servicesReady: this.servicesReady,
    }
  }

  private emit() {
    const snap = this.getSnapshot()
    for (const fn of this.listeners) fn(snap)
  }

  setServicesReady(ready: boolean) {
    this.servicesReady = ready
    this.emit()
  }

  setSending(message: string) {
    this.phase = 'sending'
    this.lastMessage = message
    this.emit()
  }

  applyFeedback(feedback: NavGoalFeedback) {
    this.distanceRemaining = feedback.distanceRemaining
    if (this.phase === 'sending' || this.phase === 'idle') {
      this.phase = 'navigating'
    }
    this.emit()
  }

  applyStatus(status: number) {
    this.goalStatus = status
    switch (status) {
      case GOAL_STATUS.EXECUTING:
      case GOAL_STATUS.ACCEPTED:
        this.phase = 'navigating'
        break
      case GOAL_STATUS.SUCCEEDED:
        this.phase = 'succeeded'
        this.distanceRemaining = 0
        this.lastMessage = 'Goal succeeded'
        break
      case GOAL_STATUS.CANCELED:
        this.phase = 'canceled'
        break
      case GOAL_STATUS.ABORTED:
        this.phase = 'aborted'
        break
      default:
        break
    }
    this.emit()
  }

  setFailed(message: string) {
    this.phase = 'failed'
    this.lastMessage = message
    this.emit()
  }

  setMessage(message: string) {
    this.lastMessage = message
    this.emit()
  }

  resetNav() {
    this.phase = 'idle'
    this.distanceRemaining = null
    this.goalStatus = null
    this.emit()
  }
}

export const navGoalStore = new NavGoalStore()
