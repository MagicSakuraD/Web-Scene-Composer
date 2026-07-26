'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useSetAtom } from 'jotai'
import * as THREE from 'three'
import { selectedNodeIdAtom, selectedObjectReadyAtom } from '@/lib/scene/atoms'
import { selectedTrackIdAtom } from '@/lib/annotations/atoms'
import { resolvePickedNodeId } from '@/lib/scene/object-registry'
import { resolveAnnotationTrackId } from '@/lib/annotations/object-registry'
import { shouldSkipViewportPick } from '@/lib/viewport/transform-gizmo-state'

const _pointer = new THREE.Vector2()
const _raycaster = new THREE.Raycaster()

/**
 * 左键拾取；annotation 与场景节点互斥。
 * pointerup 执行以免与 TransformControls 拖拽冲突。
 */
export function ViewportPicker() {
  const { camera, scene, gl } = useThree()
  const setSelectedNode = useSetAtom(selectedNodeIdAtom)
  const setSelectedTrack = useSetAtom(selectedTrackIdAtom)
  const bumpObjectReady = useSetAtom(selectedObjectReadyAtom)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = gl.domElement

    const pickAt = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1

      _raycaster.setFromCamera(_pointer, camera)
      const hits = _raycaster.intersectObjects(scene.children, true)

      for (const hit of hits) {
        if (hit.object.userData.ignorePick) continue
        if (hit.object instanceof THREE.Points) continue

        const trackId = resolveAnnotationTrackId(hit.object)
        if (trackId) {
          setSelectedTrack(trackId)
          setSelectedNode(null)
          return
        }

        const nodeId = resolvePickedNodeId(hit.object, hit.instanceId)
        if (nodeId) {
          setSelectedNode(nodeId)
          setSelectedTrack(null)
          bumpObjectReady((n) => n + 1)
          return
        }
      }

      setSelectedNode(null)
      setSelectedTrack(null)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      pointerDownRef.current = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      const down = pointerDownRef.current
      pointerDownRef.current = null
      if (!down) return
      if (shouldSkipViewportPick()) return

      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (dx * dx + dy * dy > 36) return

      pickAt(e.clientX, e.clientY)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
    }
  }, [camera, scene, gl, setSelectedNode, setSelectedTrack, bumpObjectReady])

  return null
}
