import type { TransformControls as TransformControlsImpl } from 'three-stdlib'

/** 供 ViewportPicker 避免与 TransformControls 抢事件 */
export const transformGizmoState = {
  controls: null as TransformControlsImpl | null,
  dragging: false,
  /** Gizmo 拖拽中的 sceneNodeId，用于跳过 atom → Three.js 回写 */
  draggingNodeId: null as string | null,
}

export function shouldSkipViewportPick() {
  const tc = transformGizmoState.controls
  return transformGizmoState.dragging || Boolean(tc?.axis)
}
