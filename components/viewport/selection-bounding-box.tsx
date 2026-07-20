'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { selectedNodeIdAtom, selectedObjectReadyAtom } from '@/lib/scene/atoms'
import { resolveRegisteredRoot } from '@/lib/scene/object-registry'
import { computeSelectionBox3, SELECTION_BOX_COLOR } from '@/lib/scene/selection-bounds'

/**
 * 选中高亮：世界空间 AABB 线框（类似 [three.js editor](https://threejs.org/editor/) / YOLO 3D bbox）。
 */
export function SelectionBoundingBox() {
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const objectReady = useAtomValue(selectedObjectReadyAtom)
  const { scene } = useThree()
  const helperRef = useRef<THREE.Box3Helper | null>(null)
  const targetRef = useRef<THREE.Object3D | null>(null)

  useEffect(() => {
    const disposeHelper = () => {
      const helper = helperRef.current
      if (helper) {
        scene.remove(helper)
        helper.dispose()
        helperRef.current = null
      }
      targetRef.current = null
    }

    if (!selectedId) {
      disposeHelper()
      return disposeHelper
    }

    const target = resolveRegisteredRoot(selectedId)
    if (!target) {
      disposeHelper()
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Selection] 尚未注册 Three 对象（glTF 可能仍在加载）:', selectedId)
      }
      return disposeHelper
    }

    const box = new THREE.Box3()
    computeSelectionBox3(target, box)
    if (box.isEmpty()) {
      disposeHelper()
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Selection] 包围盒为空:', selectedId)
      }
      return disposeHelper
    }

    disposeHelper()

    const helper = new THREE.Box3Helper(box, SELECTION_BOX_COLOR)
    helper.name = '__wsc_selection_bbox__'
    helper.userData.isSelectionBox = true
    helper.userData.ignorePick = true
    helper.renderOrder = 999

    const mat = helper.material
    if (!Array.isArray(mat)) {
      mat.allowOverride = false
      mat.depthTest = true
      mat.transparent = false
    }

    scene.add(helper)
    helperRef.current = helper
    targetRef.current = target
    helper.updateMatrixWorld(true)

    return disposeHelper
  }, [selectedId, objectReady, scene])

  useFrame(() => {
    const target = targetRef.current
    const helper = helperRef.current
    if (!target || !helper) return
    computeSelectionBox3(target, helper.box)
    helper.updateMatrixWorld(true)
  })

  return null
}
