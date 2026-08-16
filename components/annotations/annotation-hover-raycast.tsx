'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useSetAtom } from 'jotai'
import * as THREE from 'three'
import {
  annotationHoverAtom,
  moveAnnotationHoverTooltip,
} from '@/lib/annotations/hover'
import {
  collectAnnotationPickables,
  resolveAnnotationHoverLabel,
} from '@/lib/annotations/object-registry'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'

const _pointer = new THREE.Vector2()
const _raycaster = new THREE.Raycaster()

/**
 * Foxglove-like: pointermove raycast → category tooltip.
 * Only tests annotation pickables (not LiDAR / warehouse meshes).
 */
export function AnnotationHoverRaycast() {
  const { camera, gl } = useThree()
  const setHover = useSetAtom(annotationHoverAtom)
  const lastKeyRef = useRef('')

  useEffect(() => {
    const canvas = gl.domElement

    const clear = () => {
      if (lastKeyRef.current === '') return
      lastKeyRef.current = ''
      setHover(null)
    }

    const onMove = (e: PointerEvent) => {
      if (transformGizmoState.dragging) {
        clear()
        return
      }

      const targets = collectAnnotationPickables()
      if (targets.length === 0) {
        clear()
        return
      }

      const rect = canvas.getBoundingClientRect()
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      _raycaster.setFromCamera(_pointer, camera)

      const hits = _raycaster.intersectObjects(targets, true)
      for (const hit of hits) {
        const obj = hit.object
        if (obj.userData.ignorePick) continue
        if (obj instanceof THREE.Points) continue

        const info = resolveAnnotationHoverLabel(obj, hit.instanceId)
        if (!info) continue

        const key = `${info.source}:${info.topic ?? ''}:${info.label}`
        if (lastKeyRef.current === key) {
          moveAnnotationHoverTooltip(e.clientX, e.clientY)
          return
        }
        lastKeyRef.current = key
        setHover({
          label: info.label,
          topic: info.topic,
          source: info.source,
          clientX: e.clientX,
          clientY: e.clientY,
        })
        return
      }
      clear()
    }

    const onLeave = () => clear()

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      clear()
    }
  }, [camera, gl, setHover])

  return null
}
