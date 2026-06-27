'use client'

import { useEffect, useRef } from 'react'
import { TransformControls } from '@react-three/drei'
import { useAtomValue, useSetAtom } from 'jotai'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { TransformControls as TransformControlsImpl } from 'three-stdlib'
import {
  transformModeAtom,
  spaceModeAtom,
  updateNodeTransformAtom,
} from '@/lib/scene/atoms'
import type { TransformMode } from '@/lib/scene/types'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'

interface TransformGizmoProps {
  object: THREE.Object3D
  nodeId: string
}

function transformsEqual(
  a: THREE.Object3D,
  position: [number, number, number],
  rotation: [number, number, number],
  scale: [number, number, number],
) {
  const epsilon = 0.001
  return (
    Math.abs(a.position.x - position[0]) < epsilon &&
    Math.abs(a.position.y - position[1]) < epsilon &&
    Math.abs(a.position.z - position[2]) < epsilon &&
    Math.abs(THREE.MathUtils.radToDeg(a.rotation.x) - rotation[0]) < epsilon &&
    Math.abs(THREE.MathUtils.radToDeg(a.rotation.y) - rotation[1]) < epsilon &&
    Math.abs(THREE.MathUtils.radToDeg(a.rotation.z) - rotation[2]) < epsilon &&
    Math.abs(a.scale.x - scale[0]) < epsilon &&
    Math.abs(a.scale.y - scale[1]) < epsilon &&
    Math.abs(a.scale.z - scale[2]) < epsilon
  )
}

/** select 模式也显示移动 Gizmo（Reality Composer Pro / Isaac Sim 习惯） */
function resolveGizmoMode(mode: TransformMode): 'translate' | 'rotate' | 'scale' {
  if (mode === 'rotate') return 'rotate'
  if (mode === 'scale') return 'scale'
  return 'translate'
}

export function TransformGizmo({ object, nodeId }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsImpl>(null)
  const isDragging = useRef(false)
  const mode = useAtomValue(transformModeAtom)
  const space = useAtomValue(spaceModeAtom)
  const setTransform = useSetAtom(updateNodeTransformAtom)
  const orbit = useThree((s) => s.controls)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    transformGizmoState.controls = controls
    return () => {
      if (transformGizmoState.controls === controls) {
        transformGizmoState.controls = null
      }
    }
  })

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const onDraggingChanged = (event: { value: unknown }) => {
      const dragging = Boolean(event.value)
      isDragging.current = dragging
      transformGizmoState.dragging = dragging
      if (orbit && 'enabled' in orbit) {
        ;(orbit as { enabled: boolean }).enabled = !dragging
      }
    }

    const onChange = () => {
      if (!isDragging.current) return

      setTransform({
        id: nodeId,
        transform: {
          position: [object.position.x, object.position.y, object.position.z],
          rotation: [
            THREE.MathUtils.radToDeg(object.rotation.x),
            THREE.MathUtils.radToDeg(object.rotation.y),
            THREE.MathUtils.radToDeg(object.rotation.z),
          ],
          scale: [object.scale.x, object.scale.y, object.scale.z],
        },
      })
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('objectChange', onChange)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      controls.removeEventListener('objectChange', onChange)
      transformGizmoState.dragging = false
    }
  }, [object, nodeId, setTransform, orbit])

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={resolveGizmoMode(mode)}
      space={space}
      size={0.85}
      translationSnap={null}
      showX
      showY
      showZ
    />
  )
}

export { transformsEqual }
