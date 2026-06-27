import type { LucideIcon } from 'lucide-react'
import {
  Mountain,
  Box,
  Circle,
  Sun,
  Lightbulb,
  FileBox,
  Trash2,
} from 'lucide-react'
import type { NodeType } from './types'

export type CreateMenuAction =
  | { kind: 'node'; type: NodeType }
  | { kind: 'import-gltf' }
  | { kind: 'delete' }

export interface CreateMenuItem {
  id: string
  label: string
  icon: LucideIcon
  action: CreateMenuAction
  /** 无有效删除目标时禁用（如 Root） */
  disabled?: boolean
}

export interface CreateMenuSection {
  id: string
  label: string
  items: CreateMenuItem[]
}

export const CREATE_MENU_SECTIONS: CreateMenuSection[] = [
  {
    id: 'physics',
    label: 'Physics',
    items: [
      { id: 'ground', label: 'Ground Plane', icon: Mountain, action: { kind: 'node', type: 'ground' } },
    ],
  },
  {
    id: 'lights',
    label: 'Lights',
    items: [
      { id: 'distant-light', label: 'Distant Light', icon: Sun, action: { kind: 'node', type: 'distant-light' } },
      { id: 'point-light', label: 'Point Light', icon: Lightbulb, action: { kind: 'node', type: 'point-light' } },
    ],
  },
  {
    id: 'shapes',
    label: 'Shape',
    items: [
      { id: 'cube', label: 'Cube', icon: Box, action: { kind: 'node', type: 'cube' } },
      { id: 'sphere', label: 'Sphere', icon: Circle, action: { kind: 'node', type: 'sphere' } },
    ],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { id: 'import', label: 'Import glTF / GLB…', icon: FileBox, action: { kind: 'import-gltf' } },
    ],
  },
]

/** 右键菜单底部「删除」项（目标节点由 contextMenuAtom.nodeId 或当前选中决定） */
export function buildDeleteMenuItem(nodeName: string | null, canDelete: boolean): CreateMenuItem {
  return {
    id: 'delete',
    label: nodeName ? `Delete "${nodeName}"` : 'Delete',
    icon: Trash2,
    action: { kind: 'delete' },
    disabled: !canDelete,
  }
}

export const PROJECT_NAME = 'Web-Scene-Composer'

export const SUPPORTED_ASSET_EXTENSIONS = ['.glb', '.gltf'] as const

export function isGltfFile(name: string) {
  const lower = name.toLowerCase()
  return lower.endsWith('.glb') || lower.endsWith('.gltf')
}
