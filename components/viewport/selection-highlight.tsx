'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { sceneNodesAtom, selectedNodeIdAtom } from '@/lib/scene/atoms'
import { applySelectionHighlight } from '@/lib/scene/object-registry'

/** Sync outliner selection → viewport mesh highlight (Blender-style) */
export function SelectionHighlight() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const nodes = useAtomValue(sceneNodesAtom)

  useEffect(() => {
    applySelectionHighlight(selectedId, nodes)
    return () => applySelectionHighlight(null, nodes)
  }, [selectedId, nodes])

  return null
}
