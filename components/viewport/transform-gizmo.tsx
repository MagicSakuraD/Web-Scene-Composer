'use client'

import { useCallback, useEffect, useRef } from 'react'
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
import type { Transform, TransformMode } from '@/lib/scene/types'
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

function objectToTransform(object: THREE.Object3D): Transform {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    rotation: [
      THREE.MathUtils.radToDeg(object.rotation.x),
      THREE.MathUtils.radToDeg(object.rotation.y),
      THREE.MathUtils.radToDeg(object.rotation.z),
    ],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  }
}

/** 仅 translate / rotate / scale 模式显示 Gizmo（select 模式只显示轮廓） */
function resolveGizmoMode(mode: TransformMode): 'translate' | 'rotate' | 'scale' {
  if (mode === 'rotate') return 'rotate'
  if (mode === 'scale') return 'scale'
  return 'translate'
}

export function TransformGizmo({ object, nodeId }: TransformGizmoProps) {
  const controlsRef = useRef<TransformControlsImpl>(null)
  const objectRef = useRef(object)
  const nodeIdRef = useRef(nodeId)
  objectRef.current = object
  nodeIdRef.current = nodeId

  const mode = useAtomValue(transformModeAtom)
  const space = useAtomValue(spaceModeAtom)
  const setTransform = useSetAtom(updateNodeTransformAtom)
  const orbit = useThree((s) => s.controls)

  const commitTransform = useCallback(() => {
    setTransform({
      id: nodeIdRef.current,
      transform: objectToTransform(objectRef.current),
    })
  }, [setTransform])

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
      transformGizmoState.dragging = dragging
      transformGizmoState.draggingNodeId = dragging ? nodeIdRef.current : null

      if (orbit && 'enabled' in orbit) {
        ;(orbit as { enabled: boolean }).enabled = !dragging
      }

      // 拖拽中只 mutate Three.js；松手后一次性写回 jotai，避免每帧触发 React 重渲染
      if (!dragging) {
        commitTransform()
      }
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      transformGizmoState.dragging = false
      transformGizmoState.draggingNodeId = null
    }
  }, [commitTransform, orbit])

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

export { transformsEqual, objectToTransform }
