/** 货架作业：Web 只调 /job/start、/job/cancel，再订 /job/status */
export const JOB_START_SERVICE = '/job/start'
export const JOB_CANCEL_SERVICE = '/job/cancel'
export const JOB_STATUS_TOPIC = '/job/status'
export const JOB_MAP_FRAME = 'map'

export const DEFAULT_PICK_LOCATION_ID = 'shelf_A01'
export const DEFAULT_DROP_LOCATION_ID = 'drop_zone_01'

export const PICK_MARKER_COLOR = '#22c55e'
export const DROP_MARKER_COLOR = '#ef4444'

export const JOB_PHASE = {
  IDLE: 0,
  PICK_NAV: 1,
  PICK_DOCK: 2,
  DROP_NAV: 3,
  DROP_DOCK: 4,
  DONE: 5,
  FAILED: 6,
  CANCELED: 7,
} as const

export const JOB_PHASE_NAMES = [
  'IDLE',
  'PICK_NAV',
  'PICK_DOCK',
  'DROP_NAV',
  'DROP_DOCK',
  'DONE',
  'FAILED',
  'CANCELED',
] as const

export type JobPhaseName = (typeof JOB_PHASE_NAMES)[number]

export function jobPhaseNameFromCode(phase: number): JobPhaseName | null {
  return JOB_PHASE_NAMES[phase] ?? null
}
