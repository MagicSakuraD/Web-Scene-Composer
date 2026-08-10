import type { BtNodeCategory, BtNodeStatus } from '@/lib/ros/bt-timeline-store'

const RECOVERY_PATTERNS = [
  /^spin$/i,
  /^backup$/i,
  /^back_up$/i,
  /^wait$/i,
  /^driveonheading$/i,
  /^assistedteleop$/i,
  /^clearcostmap/i,
  /^clear.*costmap/i,
  /^recovery/i,
]

const PLANNING_PATTERNS = [
  /^computepath/i,
  /^computepathtopose$/i,
  /^computepaththroughposes$/i,
  /^planner/i,
  /^smoother/i,
  /^remap/i,
]

const CONTROL_PATTERNS = [/^followpath$/i, /^controller/i, /^goalchecker/i, /^progress/i]

const CONDITION_PATTERNS = [/^is/i, /^goal/i, /^transform/i, /^timed/i, /^distance/i]

export function normalizeBtStatus(raw: string): BtNodeStatus {
  const s = raw.trim().toUpperCase()
  if (s === 'IDLE' || s === 'RUNNING' || s === 'SUCCESS' || s === 'FAILURE') return s
  return 'UNKNOWN'
}

export function classifyBtNode(nodeName: string): BtNodeCategory {
  const base = nodeName.includes('::') ? nodeName.split('::').pop()! : nodeName
  if (RECOVERY_PATTERNS.some((p) => p.test(base))) return 'recovery'
  if (PLANNING_PATTERNS.some((p) => p.test(base))) return 'planning'
  if (CONTROL_PATTERNS.some((p) => p.test(base))) return 'control'
  if (CONDITION_PATTERNS.some((p) => p.test(base))) return 'condition'
  return 'other'
}

export function isInterestingBtNode(nodeName: string): boolean {
  const cat = classifyBtNode(nodeName)
  if (cat !== 'other' && cat !== 'condition') return true
  const base = nodeName.includes('::') ? nodeName.split('::').pop()! : nodeName
  return /pipeline|sequence|selector|reactive|navigate/i.test(base)
}

export function formatBtNodeLabel(nodeName: string): string {
  if (!nodeName.includes('::')) return nodeName
  const parts = nodeName.split('::')
  return parts.length > 1 ? parts.slice(-2).join('::') : nodeName
}
