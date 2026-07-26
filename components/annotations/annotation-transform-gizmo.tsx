'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { TransformControls } from '@react-three/drei'
import { useAtomValue, useSetAtom } from 'jotai'
import { useThree } from '@react-three/fiber'
import type { TransformControls as TransformControlsImpl } from 'three-stdlib'
import {
  selectedTrackIdAtom,
  selectedTrackAtom,
  setAnnotationKeyframeAtom,
} from '@/lib/annotations/atoms'
import {
  annotationObjectByTrackId,
  getAnnotationRegistryGeneration,
  subscribeAnnotationRegistry,
} from '@/lib/annotations/object-registry'
import { transformModeAtom, spaceModeAtom } from '@/lib/scene/atoms'
import type { TransformMode } from '@/lib/scene/types'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'
import { playbackTimeNsAtom, appModeAtom } from '@/lib/playback/atoms'
import { poseFromDisplayFrame } from '@/lib/ros/annotation-frame'
import { getPlaybackCloudFrameId } from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

function resolveGizmoMode(mode: TransformMode): 'translate' | 'rotate' | 'scale' {
  if (mode === 'rotate') return 'rotate'
  if (mode === 'scale') return 'scale'
  return 'translate'
}

function useAnnotationRegistryGeneration(): number {
  return useSyncExternalStore(
    subscribeAnnotationRegistry,
    getAnnotationRegistryGeneration,
    getAnnotationRegistryGeneration,
  )
}

/**
 * Playback-only gizmo for annotation tracks.
 * Object lives under ROS_TO_THREE parent → local pose is ROS display-frame.
 * Only attach when the target is parented in the scene graph (avoids TransformControls warnings).
 */
export function AnnotationTransformGizmo() {
  const appMode = useAtomValue(appModeAtom)
  const trackId = useAtomValue(selectedTrackIdAtom)
  const track = useAtomValue(selectedTrackAtom)
  const mode = useAtomValue(transformModeAtom)
  const space = useAtomValue(spaceModeAtom)
  const timeNs = useAtomValue(playbackTimeNsAtom)
  const setKeyframe = useSetAtom(setAnnotationKeyframeAtom)
  const orbit = useThree((s) => s.controls)
  const registryGen = useAnnotationRegistryGeneration()

  const controlsRef = useRef<TransformControlsImpl>(null)
  const trackIdRef = useRef(trackId)
  const trackRef = useRef(track)
  const timeNsRef = useRef(timeNs)
  trackIdRef.current = trackId
  trackRef.current = track
  timeNsRef.current = timeNs

  const object = trackId ? annotationObjectByTrackId.get(trackId) : undefined
  const objectInScene = Boolean(object?.parent)
  void registryGen

  const commit = useCallback(() => {
    const id = trackIdRef.current
    const t = trackRef.current
    const obj = id ? annotationObjectByTrackId.get(id) : undefined
    if (!id || !t || !obj?.parent) return

    const displayFrame = lidarPointStore.frameId || getPlaybackCloudFrameId()
    const baseSize = (obj.userData.annotationBaseSize as [number, number, number] | undefined) ?? [
      1, 1, 1,
    ]
    const size: [number, number, number] = [
      Math.max(1e-3, Math.abs(baseSize[0] * obj.scale.x)),
      Math.max(1e-3, Math.abs(baseSize[1] * obj.scale.y)),
      Math.max(1e-3, Math.abs(baseSize[2] * obj.scale.z)),
    ]
    obj.scale.set(1, 1, 1)
    obj.userData.annotationBaseSize = size

    const displayPos: [number, number, number] = [obj.position.x, obj.position.y, obj.position.z]
    const displayOri: [number, number, number, number] = [
      obj.quaternion.x,
      obj.quaternion.y,
      obj.quaternion.z,
      obj.quaternion.w,
    ]
    const stored = poseFromDisplayFrame(t.frameId, displayFrame, displayPos, displayOri)

    setKeyframe({
      trackId: id,
      keyframe: {
        timeNs: timeNsRef.current,
        position: stored.position,
        orientation: stored.orientation,
        size,
      },
    })
  }, [setKeyframe])

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
      transformGizmoState.draggingNodeId = dragging ? trackIdRef.current : null

      if (orbit && 'enabled' in orbit) {
        ;(orbit as { enabled: boolean }).enabled = !dragging
      }

      if (!dragging) commit()
    }

    controls.addEventListener('dragging-changed', onDraggingChanged)
    return () => {
      controls.removeEventListener('dragging-changed', onDraggingChanged)
      transformGizmoState.dragging = false
      transformGizmoState.draggingNodeId = null
    }
  }, [commit, orbit, object, objectInScene])

  if (appMode !== 'playback') return null
  if (!trackId || !track || !object || !objectInScene) return null
  if (mode === 'select') return null

  return (
    <TransformControls
      ref={controlsRef}
      object={object}
      mode={resolveGizmoMode(mode)}
      space={space}
      size={0.9}
      translationSnap={null}
      showX
      showY
      showZ
    />
  )
}
