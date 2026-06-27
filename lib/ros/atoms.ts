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

export type BottomPanelTabType =
  | 'project-browser'
  | 'console'
  | 'diff-drive'
  | 'camera-viewer'
  | 'lidar-viewer'

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

/** 可添加的底部面板类型（文案见 lib/i18n/panel-messages.ts） */
export { ADDABLE_PANEL_TYPES } from '@/lib/i18n/panel-messages'

/** Nova Carter 默认压缩相机话题（image_transport） */
export const DEFAULT_CAMERA_COMPRESSED_TOPICS = [
  '/front_stereo_camera/left/image_raw/compressed',
  '/front_stereo_camera/right/image_raw/compressed',
] as const

/** 摄像头面板当前选中的 ROS 图像话题 */
export const cameraViewerTopicsAtom = atom<string[]>([])

export const DEFAULT_LIDAR_TOPIC = '/front_3d_lidar/lidar_points'

export type LidarColorMode = 'turbo' | 'solid'

export interface LidarDisplayConfig {
  /** 在 3D 视口显示点云 */
  visible: boolean
  topic: string
  pointSize: number
  color: string
  opacity: number
  sizeAttenuation: boolean
  /** 挂载到 glTF 雷达节点 front_RPLidar（静态外参，不订 /tf） */
  followRobot: boolean
  /** turbo：GPU 高度渐变色；solid：单色 */
  colorMode: LidarColorMode
  /** 手动高度下界（null = 每帧自动） */
  heightMin: number | null
  /** 手动高度上界（null = 每帧自动） */
  heightMax: number | null
}

export const lidarDisplayAtom = atom<LidarDisplayConfig>({
  visible: true,
  topic: DEFAULT_LIDAR_TOPIC,
  pointSize: 0.04,
  color: '#00ffcc',
  opacity: 0.85,
  sizeAttenuation: true,
  followRobot: true,
  colorMode: 'turbo',
  heightMin: null,
  heightMax: null,
})
