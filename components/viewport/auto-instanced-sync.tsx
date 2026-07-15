'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { syncAutoInstancedMeshes } from '@/lib/scene/instance-identical-meshes'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'
import type * as THREE from 'three'

/**
 * Gizmo 拖动 proxy 时，把矩阵刷回 InstancedMesh。
 * 仅拖拽中 + 松手当帧同步，避免每帧全量扫仓库
 *（见 https://r3f.docs.pmnd.rs/advanced/pitfalls ）。
 */
export function AutoInstancedSync({ root }: { root: THREE.Object3D }) {
  const wasDragging = useRef(false)

  useFrame(() => {
    if (!root.userData.autoInstancedBuckets) return
    const dragging = transformGizmoState.dragging
    if (dragging || wasDragging.current) {
      syncAutoInstancedMeshes(root)
    }
    wasDragging.current = dragging
  })

  return null
}
