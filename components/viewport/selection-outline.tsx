'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { selectedNodeIdAtom, selectedObjectReadyAtom } from '@/lib/scene/atoms'
import { applySelectionHighlight } from '@/lib/scene/object-registry'

/**
 * Blender 风格选中高亮（亮黄色）。
 * 使用 BackSide hull + MeshBasicMaterial，兼容 WebGPURenderer（不用 drei Outlines / ShaderMaterial）。
 */
export function SelectionOutline() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const objectReady = useAtomValue(selectedObjectReadyAtom)

  useEffect(() => {
    applySelectionHighlight(selectedId)
    return () => applySelectionHighlight(null)
  }, [selectedId, objectReady])

  return null
}
