import { getDefaultStore } from 'jotai'
import { sceneNodesAtom, selectedNodeIdAtom } from './atoms'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { VIEWPORT_PHYSICAL_LIGHT_ID } from '@/lib/viewport/physical-light-node'
import type { SceneNode } from './types'

type NodesSnapshot = Record<string, SceneNode>

/**
 * 忽略视口 Sun 辅助灯（由 Sun 开关驱动、非真实编辑）后判断两份场景是否一致。
 * 节点对象不可变、更新时结构共享，故按引用逐一比较即可（仅改动节点引用不同）。
 */
function sameExceptEphemeral(a: NodesSnapshot, b: NodesSnapshot): boolean {
  const aKeys = Object.keys(a).filter((k) => k !== VIEWPORT_PHYSICAL_LIGHT_ID)
  const bKeys = Object.keys(b).filter((k) => k !== VIEWPORT_PHYSICAL_LIGHT_ID)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false
  }
  return true
}

/** 撤销栈上限；快照间有结构共享（未改动节点复用引用），单条几乎只是一层外壳 */
const MAX_HISTORY = 50

const store = getDefaultStore()

const undoStack: NodesSnapshot[] = []
const redoStack: NodesSnapshot[] = []
/** 变化前的场景快照；与当前值比较用于识别真实编辑 */
let prev: NodesSnapshot = store.get(sceneNodesAtom)
/** 撤销/重做自身写回时置位，避免把回滚当成新编辑记入历史 */
let restoring = false

const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function subscribeSceneHistory(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function canUndo(): boolean {
  return undoStack.length > 0
}

export function canRedo(): boolean {
  return redoStack.length > 0
}

/** Simulate 连接期间禁用撤销，避免误改联调中的场景 */
function isSimulating(): boolean {
  const status = store.get(simulateStatusAtom)
  return status === 'connecting' || status === 'connected'
}

// 记录每一次 sceneNodesAtom 变化（拖拽已在 gizmo 松手时合并为一次写入；
// 运行时机器人位姿走 Three.js，不写该 atom，故不会污染历史）
store.sub(sceneNodesAtom, () => {
  const cur = store.get(sceneNodesAtom)
  if (restoring) {
    prev = cur
    return
  }
  if (cur === prev) return
  // 纯 Sun 开关 / 初始化挂灯：不记入历史，只更新基准
  if (sameExceptEphemeral(cur, prev)) {
    prev = cur
    return
  }
  undoStack.push(prev)
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack.length = 0
  prev = cur
  notify()
})

/** 回滚后若当前选中节点已不存在，则清空选中 */
function reconcileSelection(nodes: NodesSnapshot) {
  const selected = store.get(selectedNodeIdAtom)
  if (selected && !nodes[selected]) {
    store.set(selectedNodeIdAtom, null)
  }
}

function restore(target: NodesSnapshot) {
  // 保留当前 Sun 辅助灯状态，避免撤销/重做把它一并翻转
  const live = store.get(sceneNodesAtom)
  const liveLight = live[VIEWPORT_PHYSICAL_LIGHT_ID]
  let next = target
  if (liveLight !== target[VIEWPORT_PHYSICAL_LIGHT_ID]) {
    next = { ...target }
    if (liveLight) next[VIEWPORT_PHYSICAL_LIGHT_ID] = liveLight
    else delete next[VIEWPORT_PHYSICAL_LIGHT_ID]
  }
  restoring = true
  store.set(sceneNodesAtom, next)
  prev = next
  restoring = false
  reconcileSelection(next)
  notify()
}

export function undo(): void {
  if (isSimulating() || undoStack.length === 0) return
  const cur = store.get(sceneNodesAtom)
  const target = undoStack.pop()!
  redoStack.push(cur)
  restore(target)
}

export function redo(): void {
  if (isSimulating() || redoStack.length === 0) return
  const cur = store.get(sceneNodesAtom)
  const target = redoStack.pop()!
  undoStack.push(cur)
  restore(target)
}
