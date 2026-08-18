import type { BottomPanelTabType } from '@/lib/ros/atoms'
import type { MessageKey } from './messages'

/** 可「+」添加的底部面板（雷达点云由 Topics 眼睛驱动，不再单独加 Tab） */
export const ADDABLE_PANEL_TYPES: BottomPanelTabType[] = [
  'diff-drive',
  'camera-viewer',
  'nav-goal',
  'shelf-job',
]

const PANEL_NAME_KEYS: Partial<Record<BottomPanelTabType, MessageKey>> = {
  'project-browser': 'panels.projectBrowser.name',
  console: 'panels.console.name',
  'diff-drive': 'panels.diffDrive.name',
  'camera-viewer': 'panels.cameraViewer.name',
  'lidar-viewer': 'panels.lidarViewer.name',
  'material-graph': 'panels.materialGraph.name',
  'nav-goal': 'panels.navGoal.name',
  'shelf-job': 'panels.shelfJob.name',
}

const PANEL_DESC_KEYS: Partial<Record<BottomPanelTabType, MessageKey>> = {
  'diff-drive': 'panels.diffDrive.description',
  'camera-viewer': 'panels.cameraViewer.description',
  'lidar-viewer': 'panels.lidarViewer.description',
  'material-graph': 'panels.materialGraph.description',
  'nav-goal': 'panels.navGoal.description',
  'shelf-job': 'panels.shelfJob.description',
}

export function panelNameKey(type: BottomPanelTabType): MessageKey | undefined {
  return PANEL_NAME_KEYS[type]
}

export function panelDescriptionKey(type: BottomPanelTabType): MessageKey | undefined {
  return PANEL_DESC_KEYS[type]
}
