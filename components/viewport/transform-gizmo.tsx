'use client'

import { useEffect, useRef } from 'react'
import { TransformControls } from '@react-three/drei'
import { useAtomValue, useSetAtom } from 'jotai'
import * as THREE from 'three'
import type { TransformControls as TransformControlsImpl } from 'three-stdlib'
import {
  transformModeAtom,
  spaceModeAtom,
  updateNodeTransformAtom,
} from '@/lib/scene/atoms'

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

export function TransformGizmo({ object, nodeId }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsImpl>(null)
  const isDragging = useRef(false)
  const mode = useAtomValue(transformModeAtom)
  const space = useAtomValue(spaceModeAtom)
  const setTransform = useSetAtom(updateNodeTransformAtom)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const onDraggingChanged = (event: { value: unknown }) => {
      isDragging.current = Boolean(event.value)
    }

    const onChange = () => {
      if (!isDragging.current) return

      const nextPosition: [number, number, number] = [
        object.position.x,
        object.position.y,
        object.position.z,
      ]
      const nextRotation: [number, number, number] = [
        THREE.MathUtils.radToDeg(object.rotation.x),
        THREE.MathUtils.radToDeg(object.rotation.y),
        THREE.MathUtils.radToDeg(object.rotation.z),
      ]
      const nextScale: [number, number, number] = [
        object.scale.x,
        object.scale.y,
        object.scale.z,
      ]

      setTransform({
        id: nodeId,
        transform: {
          position: nextPosition,
          rotation: nextRotation,
          scale: nextScale,
        },
      })
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    controls.addEventListener('objectChange', onChange)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      controls.removeEventListener('objectChange', onChange)
    }
  }, [object, nodeId, setTransform])

  if (mode === 'select') return null

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={mode === 'translate' ? 'translate' : mode === 'rotate' ? 'rotate' : 'scale'}
      space={space}
    />
  )
}

export { transformsEqual }
