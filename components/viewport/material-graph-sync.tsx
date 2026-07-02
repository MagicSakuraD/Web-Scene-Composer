'use client'

import { useEffect, useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { activeMaterialGraphAtom, materialGraphTargetIdAtom } from '@/lib/material-graph/atoms'
import { compileMaterialGraph } from '@/lib/material-graph/compile-tsl-material'
import { isMaterialGraphAppliable } from '@/lib/material-graph/graph-validation'
import { applyNodeMaterialToObject } from '@/lib/material-graph/apply-to-scene'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { VIEWPORT_WEBGPU_FEATURES } from '@/lib/viewport/visual-config'

export function MaterialGraphSync() {
  const graph = useAtomValue(activeMaterialGraphAtom)
  const targetId = useAtomValue(materialGraphTargetIdAtom)

  const compiled = useMemo(() => {
    if (!VIEWPORT_WEBGPU_FEATURES.materialGraph || !graph) return null
    if (!isMaterialGraphAppliable(graph)) return null
    try {
      return compileMaterialGraph(graph)
    } catch {
      return null
    }
  }, [graph])

  useEffect(() => {
    if (!VIEWPORT_WEBGPU_FEATURES.materialGraph || !compiled || !targetId) return

    const obj = objectByNodeId.get(targetId)
    if (!obj) return
    applyNodeMaterialToObject(obj, compiled)
  }, [compiled, targetId])

  return null
}
