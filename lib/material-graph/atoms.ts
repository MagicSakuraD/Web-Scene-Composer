import { atom } from 'jotai'
import { selectedNodeIdAtom } from '@/lib/scene/atoms'
import type { MaterialGraph } from './types'

/** sceneNodeId → 该 mesh 的 Shader Graph（Blender 式：选中物体显示其材质图） */
export const materialGraphsByNodeIdAtom = atom<Record<string, MaterialGraph>>({})

/** 为当前选中 mesh 新建 Shader Graph（不自动填充默认节点） */
export const createMaterialGraphAtom = atom(
  null,
  (get, set, graph: MaterialGraph) => {
    const nodeId = get(selectedNodeIdAtom)
    if (!nodeId) return
    const all = get(materialGraphsByNodeIdAtom)
    set(materialGraphsByNodeIdAtom, { ...all, [nodeId]: graph })
  },
)

/** 当前选中 mesh 的材质图读写 */
export const activeMaterialGraphAtom = atom(
  (get) => {
    const nodeId = get(selectedNodeIdAtom)
    if (!nodeId) return null
    return get(materialGraphsByNodeIdAtom)[nodeId] ?? null
  },
  (get, set, update: MaterialGraph | ((prev: MaterialGraph) => MaterialGraph)) => {
    const nodeId = get(selectedNodeIdAtom)
    if (!nodeId) return
    const all = get(materialGraphsByNodeIdAtom)
    const current = all[nodeId]
    if (!current) return
    const next = typeof update === 'function' ? update(current) : update
    set(materialGraphsByNodeIdAtom, { ...all, [nodeId]: next })
  },
)

/** @deprecated 使用 materialGraphsByNodeIdAtom + activeMaterialGraphAtom */
export const materialGraphAtom = atom<MaterialGraph | null>((get) =>
  get(activeMaterialGraphAtom),
)

export const materialGraphTargetIdAtom = selectedNodeIdAtom
