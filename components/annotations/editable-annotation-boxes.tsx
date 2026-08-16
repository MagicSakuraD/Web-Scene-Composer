'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import { getDefaultStore } from 'jotai'
import * as THREE from 'three'
import {
  annotationTracksAtom,
  selectedTrackIdAtom,
} from '@/lib/annotations/atoms'
import { sampleTracksAt, type SampledAnnotationBox } from '@/lib/annotations/types'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { applyDisplayPoseToObject } from '@/lib/ros/annotation-frame'
import { getPlaybackCloudFrameId, getPlaybackGroundLiftY } from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import {
  registerAnnotationObject,
  unregisterAnnotationObject,
} from '@/lib/annotations/object-registry'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'
import { playbackTimeNsAtom } from '@/lib/playback/atoms'

interface EditableSlot {
  group: THREE.Group
  mesh: THREE.Mesh
  fillMat: THREE.MeshBasicMaterial
  edgeMat: THREE.LineBasicMaterial
}

function createSlot(
  trackId: string,
  unitBox: THREE.BoxGeometry,
  unitEdges: THREE.EdgesGeometry,
  parent: THREE.Object3D,
): EditableSlot {
  const group = new THREE.Group()
  const fillMat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const edgeMat = new THREE.LineBasicMaterial({
    transparent: true,
    toneMapped: false,
    depthTest: true,
  })
  const mesh = new THREE.Mesh(unitBox, fillMat)
  const edges = new THREE.LineSegments(unitEdges, edgeMat)
  group.add(mesh)
  group.add(edges)
  group.userData.annotationTrackId = trackId
  group.userData.annotationSource = 'editable'
  mesh.userData.annotationTrackId = trackId
  mesh.userData.annotationSource = 'editable'
  edges.userData.annotationTrackId = trackId
  parent.add(group)
  registerAnnotationObject(trackId, group)
  return { group, mesh, fillMat, edgeMat }
}

function updateSlot(slot: EditableSlot, box: SampledAnnotationBox, displayFrame: string, selected: boolean) {
  const dragging =
    transformGizmoState.dragging && transformGizmoState.draggingNodeId === box.trackId

  const sx = Math.max(1e-3, Math.abs(box.size[0]) || 1e-3)
  const sy = Math.max(1e-3, Math.abs(box.size[1]) || 1e-3)
  const sz = Math.max(1e-3, Math.abs(box.size[2]) || 1e-3)
  const size: [number, number, number] = [sx, sy, sz]
  const [r, g, b, a] = box.color

  slot.group.visible = true
  slot.group.userData.annotationLabel = box.label
  slot.group.userData.annotationBaseSize = size
  slot.mesh.userData.annotationLabel = box.label
  slot.mesh.scale.set(sx, sy, sz)

  slot.fillMat.color.setRGB(r, g, b)
  slot.fillMat.opacity = selected
    ? Math.min(0.45, Math.max(0.2, (a || 0.5) * 0.7))
    : Math.min(0.28, Math.max(0.12, (a || 0.5) * 0.5))
  slot.edgeMat.color.setRGB(r, g, b)
  slot.edgeMat.opacity = selected ? 1 : 0.85

  if (dragging) return

  applyDisplayPoseToObject(box.frameId, displayFrame, box.position, box.orientation, slot.group)
  slot.group.scale.set(1, 1, 1)
}

function disposeSlot(slot: EditableSlot, parent: THREE.Object3D | null, trackId: string) {
  unregisterAnnotationObject(trackId)
  parent?.remove(slot.group)
  slot.fillMat.dispose()
  slot.edgeMat.dispose()
}

/** Editable tracks: shared unit geometry, poses sampled in useFrame (not TF-reactive). */
export function EditableAnnotationBoxes() {
  const tracks = useAtomValue(annotationTracksAtom)
  const selectedId = useAtomValue(selectedTrackIdAtom)
  const liftRef = useRef<THREE.Group>(null)
  const rosRef = useRef<THREE.Group>(null)
  const poolRef = useRef<Map<string, EditableSlot>>(new Map())
  const tracksRef = useRef(tracks)
  const selectedRef = useRef(selectedId)
  tracksRef.current = tracks
  selectedRef.current = selectedId

  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const unitEdges = useMemo(() => new THREE.EdgesGeometry(unitBox), [unitBox])

  useEffect(() => {
    return () => {
      unitBox.dispose()
      unitEdges.dispose()
      const ros = rosRef.current
      for (const [id, slot] of poolRef.current) {
        disposeSlot(slot, ros, id)
      }
      poolRef.current.clear()
    }
  }, [unitBox, unitEdges])

  useFrame(() => {
    const ros = rosRef.current
    const lift = liftRef.current
    if (!ros || !lift) return

    lift.position.set(0, getPlaybackGroundLiftY(), 0)
    const timeNs = getDefaultStore().get(playbackTimeNsAtom)
    const sampled = sampleTracksAt(tracksRef.current, timeNs)
    const displayFrame = lidarPointStore.frameId || getPlaybackCloudFrameId()
    const selectedIdNow = selectedRef.current
    const live = new Set<string>()
    const trackIds = new Set(tracksRef.current.map((t) => t.id))

    for (const box of sampled) {
      live.add(box.trackId)
      let slot = poolRef.current.get(box.trackId)
      if (!slot) {
        slot = createSlot(box.trackId, unitBox, unitEdges, ros)
        poolRef.current.set(box.trackId, slot)
      }
      updateSlot(slot, box, displayFrame, box.trackId === selectedIdNow)
    }

    for (const [id, slot] of poolRef.current) {
      if (live.has(id)) continue
      if (!trackIds.has(id)) {
        disposeSlot(slot, ros, id)
        poolRef.current.delete(id)
      } else {
        slot.group.visible = false
      }
    }
  })

  return (
    <group ref={liftRef} name="editable-annotations">
      <group ref={rosRef} quaternion={ROS_TO_THREE_Q} />
    </group>
  )
}
