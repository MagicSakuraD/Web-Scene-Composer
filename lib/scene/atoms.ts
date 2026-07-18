import { atom } from 'jotai'
import type {
  SceneNode,
  SceneTreeNode,
  SpaceMode,
  Transform,
  TransformMode,
  UiPanelsState,
} from './types'
import { DEFAULT_TRANSFORM, type ProjectAsset, isRenderableSceneNode } from './types'
import { PROJECT_NAME } from './create-menu'

function createDefaultScene(): Record<string, SceneNode> {
  return {
    root: {
      id: 'root',
      name: 'Root',
      type: 'group',
      transform: DEFAULT_TRANSFORM,
      parentId: null,
    },
  }
}

function buildTree(
  nodes: Record<string, SceneNode>,
  parentId: string | null,
): SceneTreeNode[] {
  return Object.values(nodes)
    .filter((node) => node.parentId === parentId)
    .map((node) => ({
      ...node,
      children: buildTree(nodes, node.id),
    }))
}

export const sceneNodesAtom = atom<Record<string, SceneNode>>(createDefaultScene())
export const selectedNodeIdAtom = atom<string | null>(null)
export const transformModeAtom = atom<TransformMode>('select')
export const spaceModeAtom = atom<SpaceMode>('world')
export const hierarchySearchAtom = atom('')
export const expandedNodesAtom = atom<Set<string>>(new Set(['root']))
export const uiPanelsAtom = atom<UiPanelsState>({
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
})
export const breadcrumbAtom = atom<string[]>([PROJECT_NAME, 'Scene'])
export const projectAssetsAtom = atom<ProjectAsset[]>([])
export const selectedObjectReadyAtom = atom(0)

export const contextMenuAtom = atom<{
  x: number
  y: number
  target: 'viewport' | 'hierarchy'
  /** 层级树右键时指向的节点；视口右键则用当前选中 */
  nodeId?: string | null
} | null>(null)

export const composedStageAtom = atom<SceneTreeNode[]>((get) => {
  const nodes = get(sceneNodesAtom)
  return buildTree(nodes, null)
})

/** 3D viewport tree — excludes gltf-prim (visuals come from parent asset-ref) */
export const renderStageAtom = atom<SceneTreeNode[]>((get) => {
  const nodes = get(sceneNodesAtom)
  return buildTree(
    Object.fromEntries(
      Object.entries(nodes).filter(([, node]) => isRenderableSceneNode(node)),
    ),
    null,
  )
})

export const selectedNodeAtom = atom((get) => {
  const id = get(selectedNodeIdAtom)
  if (!id) return null
  return get(sceneNodesAtom)[id] ?? null
})

export const updateNodeTransformAtom = atom(
  null,
  (get, set, update: { id: string; transform: Partial<Transform> }) => {
    const nodes = get(sceneNodesAtom)
    const node = nodes[update.id]
    if (!node) return

    set(sceneNodesAtom, {
      ...nodes,
      [update.id]: {
        ...node,
        transform: {
          ...node.transform,
          ...update.transform,
          position: update.transform.position ?? node.transform.position,
          rotation: update.transform.rotation ?? node.transform.rotation,
          scale: update.transform.scale ?? node.transform.scale,
        },
      },
    })
  },
)

export const toggleNodeVisibilityAtom = atom(
  null,
  (get, set, update: { id: string; visible?: boolean }) => {
    const nodes = get(sceneNodesAtom)
    const node = nodes[update.id]
    if (!node) return
    const nextVisible = update.visible ?? node.visible === false
    set(sceneNodesAtom, {
      ...nodes,
      [update.id]: { ...node, visible: nextVisible },
    })
  },
)

export const updateNodePropsAtom = atom(
  null,
  (get, set, update: {
    id: string
    props: Partial<Pick<SceneNode, 'lightIntensity' | 'lightColor' | 'lightTarget' | 'name'>>
  }) => {
    const nodes = get(sceneNodesAtom)
    const node = nodes[update.id]
    if (!node) return

    set(sceneNodesAtom, {
      ...nodes,
      [update.id]: { ...node, ...update.props },
    })
  },
)
