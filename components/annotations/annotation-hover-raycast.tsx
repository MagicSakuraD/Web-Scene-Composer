'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useSetAtom } from 'jotai'
import * as THREE from 'three'
import { annotationHoverAtom } from '@/lib/annotations/hover'
import { resolveAnnotationHoverLabel } from '@/lib/annotations/object-registry'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'

const _pointer = new THREE.Vector2()
const _raycaster = new THREE.Raycaster()

/**
 * Foxglove-like: pointermove raycast → category tooltip (DOM overlay via atom).
 */
export function AnnotationHoverRaycast() {
  const { camera, scene, gl } = useThree()
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

      const rect = canvas.getBoundingClientRect()
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      _raycaster.setFromCamera(_pointer, camera)

      const hits = _raycaster.intersectObjects(scene.children, true)
      for (const hit of hits) {
        const obj = hit.object
        if (obj.userData.ignorePick) continue
        // LiDAR / path lines sit in front of boxes; only pick solid annotation meshes
        if (obj instanceof THREE.Points) continue
        if (obj instanceof THREE.Line && !(obj instanceof THREE.LineSegments)) continue
        if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.LineSegments)) continue

        const info = resolveAnnotationHoverLabel(obj)
        if (!info) continue

        lastKeyRef.current = `${info.source}:${info.topic ?? ''}:${info.label}`
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
  }, [camera, scene, gl, setHover])

  return null
}
