import type { TransformControls as TransformControlsImpl } from 'three-stdlib'

/** 供 ViewportPicker 避免与 TransformControls 抢事件 */
export const transformGizmoState = {
  controls: null as TransformControlsImpl | null,
  dragging: false,
}

export function shouldSkipViewportPick() {
  const tc = transformGizmoState.controls
  return transformGizmoState.dragging || Boolean(tc?.axis)
}
