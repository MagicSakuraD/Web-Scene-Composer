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
import type { MessageKey } from '@/lib/i18n/messages'

export type CreateMenuAction =
  | { kind: 'node'; type: NodeType }
  | { kind: 'import-gltf' }
  | { kind: 'delete' }

export interface CreateMenuItem {
  id: string
  labelKey: MessageKey
  /** 删除项等需要动态插入节点名 */
  labelParams?: Record<string, string>
  icon: LucideIcon
  action: CreateMenuAction
  /** 无有效删除目标时禁用（如 Root） */
  disabled?: boolean
}

export interface CreateMenuSection {
  id: string
  labelKey: MessageKey
  items: CreateMenuItem[]
}

export const CREATE_MENU_SECTIONS: CreateMenuSection[] = [
  {
    id: 'physics',
    labelKey: 'create.section.physics',
    items: [
      {
        id: 'ground',
        labelKey: 'create.ground',
        icon: Mountain,
        action: { kind: 'node', type: 'ground' },
      },
    ],
  },
  {
    id: 'lights',
    labelKey: 'create.section.lights',
    items: [
      {
        id: 'distant-light',
        labelKey: 'create.distantLight',
        icon: Sun,
        action: { kind: 'node', type: 'distant-light' },
      },
      {
        id: 'point-light',
        labelKey: 'create.pointLight',
        icon: Lightbulb,
        action: { kind: 'node', type: 'point-light' },
      },
    ],
  },
  {
    id: 'shapes',
    labelKey: 'create.section.shapes',
    items: [
      { id: 'cube', labelKey: 'create.cube', icon: Box, action: { kind: 'node', type: 'cube' } },
      {
        id: 'sphere',
        labelKey: 'create.sphere',
        icon: Circle,
        action: { kind: 'node', type: 'sphere' },
      },
    ],
  },
  {
    id: 'assets',
    labelKey: 'create.section.assets',
    items: [
      {
        id: 'import',
        labelKey: 'create.importGltf',
        icon: FileBox,
        action: { kind: 'import-gltf' },
      },
    ],
  },
]

/** 右键菜单底部「删除」项（目标节点由 contextMenuAtom.nodeId 或当前选中决定） */
export function buildDeleteMenuItem(nodeName: string | null, canDelete: boolean): CreateMenuItem {
  return {
    id: 'delete',
    labelKey: nodeName ? 'create.deleteNamed' : 'create.delete',
    labelParams: nodeName ? { name: nodeName } : undefined,
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
