import type { BottomPanelTabType } from '@/lib/ros/atoms'
import type { MessageKey } from './messages'

/** 可「+」添加的底部面板类型（不含内置 project-browser / console） */
export const ADDABLE_PANEL_TYPES: BottomPanelTabType[] = [
  'diff-drive',
  'camera-viewer',
  'lidar-viewer',
]

const PANEL_NAME_KEYS: Partial<Record<BottomPanelTabType, MessageKey>> = {
  'project-browser': 'panels.projectBrowser.name',
  console: 'panels.console.name',
  'diff-drive': 'panels.diffDrive.name',
  'camera-viewer': 'panels.cameraViewer.name',
  'lidar-viewer': 'panels.lidarViewer.name',
}

const PANEL_DESC_KEYS: Partial<Record<BottomPanelTabType, MessageKey>> = {
  'diff-drive': 'panels.diffDrive.description',
  'camera-viewer': 'panels.cameraViewer.description',
  'lidar-viewer': 'panels.lidarViewer.description',
}

export function panelNameKey(type: BottomPanelTabType): MessageKey | undefined {
  return PANEL_NAME_KEYS[type]
}

export function panelDescriptionKey(type: BottomPanelTabType): MessageKey | undefined {
  return PANEL_DESC_KEYS[type]
}
