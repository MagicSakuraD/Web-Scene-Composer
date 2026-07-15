import { atom } from 'jotai'
import { LIDAR_ISAAC_3D_EXTRA_ROTATION_X } from '@/lib/ros/lidar-config'
import { VIEWPORT_WEBGPU_FEATURES } from '@/lib/viewport/visual-config'

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

export { TF_TOPIC } from '@/lib/ros/tf-config'

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

export type BottomPanelTabType =
  | 'project-browser'
  | 'console'
  | 'diff-drive'
  | 'camera-viewer'
  | 'lidar-viewer'
  | 'material-graph'
  | 'nav-goal'

export interface BottomPanelTab {
  id: string
  type: BottomPanelTabType
  name: string
}

const DEFAULT_BOTTOM_PANEL_TABS: BottomPanelTab[] = [
  { id: 'project-browser', type: 'project-browser', name: 'Project Browser' },
  { id: 'console', type: 'console', name: 'Console' },
  ...(VIEWPORT_WEBGPU_FEATURES.materialGraph
    ? [{ id: 'material-graph', type: 'material-graph' as const, name: 'Material Graph' }]
    : []),
]

export const bottomPanelTabsAtom = atom<BottomPanelTab[]>(DEFAULT_BOTTOM_PANEL_TABS)

export const activeBottomTabIdAtom = atom<string>('project-browser')

/** 可添加的底部面板类型（文案见 lib/i18n/panel-messages.ts） */
export { ADDABLE_PANEL_TYPES } from '@/lib/i18n/panel-messages'

/** Nova Carter / Isaac Sim H.264 compressed 默认话题 */
export const DEFAULT_CAMERA_COMPRESSED_TOPICS = [
  '/front_stereo_camera/left/image_raw/compressed',
  '/right_stereo_camera/right/image_raw/compressed',
] as const

/** 摄像头面板当前选中的 ROS 图像话题 */
export const cameraViewerTopicsAtom = atom<string[]>([])

export const DEFAULT_LIDAR_TOPIC = '/front_3d_lidar/lidar_points'

export type LidarColorMode = 'distance' | 'turbo' | 'solid'

export { LIDAR_ISAAC_3D_EXTRA_ROTATION_X } from '@/lib/ros/lidar-config'

export interface LidarDisplayConfig {
  visible: boolean
  topic: string
  color: string
  opacity: number
  /** attach 到机器人：优先 /tf 雷达位姿，回退 glTF link */
  followRobot: boolean
  colorMode: LidarColorMode
  /** 点云局部绕 X 轴额外旋转（弧度）；Isaac 3D 雷达默认 +π/2 */
  extraRotationX: number
  /** 点云局部绕 Y 轴额外旋转（弧度）；仓库整体朝向偏差时可微调（如 π） */
  extraRotationY: number
}

export const lidarDisplayAtom = atom<LidarDisplayConfig>({
  visible: true,
  topic: DEFAULT_LIDAR_TOPIC,
  color: '#00ffcc',
  opacity: 0.85,
  followRobot: true,
  colorMode: 'distance',
  extraRotationX: LIDAR_ISAAC_3D_EXTRA_ROTATION_X,
  extraRotationY: 0,
})

export type NavGoalPhase = 'idle' | 'sending' | 'navigating' | 'succeeded' | 'canceled' | 'aborted' | 'failed'

export interface NavGoalState {
  phase: NavGoalPhase
  waypointNodeId: string | null
  lastMessage: string | null
  distanceRemaining: number | null
  recoveries: number | null
  goalStatus: number | null
  servicesReady: boolean
}

export const navGoalStateAtom = atom<NavGoalState>({
  phase: 'idle',
  waypointNodeId: null,
  lastMessage: null,
  distanceRemaining: null,
  recoveries: null,
  goalStatus: null,
  servicesReady: false,
})
