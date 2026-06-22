import { atom } from 'jotai'

export type SimulateStatus = 'idle' | 'connecting' | 'connected' | 'error'

export interface CmdVelTuning {
  maxLinear: number
  maxAngular: number
  deadzone: number
  publishHz: number
}

export interface SimulateLogEntry {
  id: string
  time: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export const CMD_VEL_TOPIC = '/cmd_vel'
export const ODOM_TOPIC = '/chassis/odom'

export { FOXGLOVE_WS_URL } from '@/lib/ros/foxglove-config'

export const simulateStatusAtom = atom<SimulateStatus>('idle')
export const simulateErrorAtom = atom<string | null>(null)
export const simulateLogsAtom = atom<SimulateLogEntry[]>([])

export const cmdVelTuningAtom = atom<CmdVelTuning>({
  maxLinear: 0.5,
  maxAngular: 0.2,
  deadzone: 0.12,
  publishHz: 20,
})

/** Latest cmd_vel sent (for UI feedback) */
export const lastCmdVelAtom = atom({ linearX: 0, angularZ: 0 })

/** Runtime target scene node id (asset-ref) driven by odom */
export const runtimeRobotNodeIdAtom = atom<string | null>(null)

export const gamepadConnectedAtom = atom(false)
export const gamepadLabelAtom = atom<string | null>(null)
export const cmdVelAdvertisedAtom = atom(false)

export type BottomPanelTabType = 'project-browser' | 'console' | 'diff-drive'

export interface BottomPanelTab {
  id: string
  type: BottomPanelTabType
  name: string
}

export const bottomPanelTabsAtom = atom<BottomPanelTab[]>([
  { id: 'project-browser', type: 'project-browser', name: 'Project Browser' },
  { id: 'console', type: 'console', name: 'Console' },
])

export const activeBottomTabIdAtom = atom<string>('project-browser')

export const ADDABLE_PANELS: { type: BottomPanelTabType; name: string; description: string }[] = [
  {
    type: 'diff-drive',
    name: '差速驱动控制器',
    description: 'Xbox 手柄 · advertise & 发布 /cmd_vel',
  },
]
