'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import {
  sampledAnnotationsAtPlayheadAtom,
  selectedTrackIdAtom,
} from '@/lib/annotations/atoms'
import type { SampledAnnotationBox } from '@/lib/annotations/types'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { poseToDisplayFrame } from '@/lib/ros/annotation-frame'
import {
  getPlaybackCloudFrameId,
  getPlaybackGroundLiftY,
} from '@/lib/ros/playback-display-frame'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import {
  registerAnnotationObject,
  unregisterAnnotationObject,
} from '@/lib/annotations/object-registry'
import { transformGizmoState } from '@/lib/viewport/transform-gizmo-state'
import { useSyncExternalStore } from 'react'

function useTfGeneration(): number {
  return useSyncExternalStore(
    (onStoreChange) => tfRuntimeStore.subscribe(onStoreChange),
    () => tfRuntimeStore.generation,
    () => tfRuntimeStore.generation,
  )
}

function useLidarFrameId(): string {
  return useSyncExternalStore(
    (onStoreChange) => lidarPointStore.subscribe(onStoreChange),
    () => lidarPointStore.getSnapshot().frameId,
    () => lidarPointStore.getSnapshot().frameId,
  )
}

function EditableBox({
  box,
  displayFrame,
  selected,
  tfGen,
}: {
  box: SampledAnnotationBox
  displayFrame: string
  selected: boolean
  tfGen: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)

  const posed = useMemo(() => {
    const p = poseToDisplayFrame(
      box.frameId,
      displayFrame,
      box.position,
      box.orientation,
    )
    const size: [number, number, number] = [
      Math.max(1e-3, Math.abs(box.size[0]) || 1e-3),
      Math.max(1e-3, Math.abs(box.size[1]) || 1e-3),
      Math.max(1e-3, Math.abs(box.size[2]) || 1e-3),
    ]
    const [r, g, b, a] = box.color
    return {
      position: p.position,
      quaternion: p.orientation,
      size,
      color: new THREE.Color(r, g, b),
      fillOpacity: selected
        ? Math.min(0.45, Math.max(0.2, (a || 0.5) * 0.7))
        : Math.min(0.28, Math.max(0.12, (a || 0.5) * 0.5)),
      edgeOpacity: selected ? 1 : 0.85,
    }
  }, [box, displayFrame, selected, tfGen])

  const { boxGeo, edgesGeo } = useMemo(() => {
    const boxG = new THREE.BoxGeometry(posed.size[0], posed.size[1], posed.size[2])
    const edges = new THREE.EdgesGeometry(boxG)
    return { boxGeo: boxG, edgesGeo: edges }
  }, [posed.size[0], posed.size[1], posed.size[2]])

  useEffect(() => {
    return () => {
      boxGeo.dispose()
      edgesGeo.dispose()
    }
  }, [boxGeo, edgesGeo])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    registerAnnotationObject(box.trackId, g)
    g.userData.annotationTrackId = box.trackId
    g.userData.annotationBaseSize = posed.size
    g.userData.annotationLabel = box.label
    g.userData.annotationSource = 'editable'
    return () => unregisterAnnotationObject(box.trackId)
  }, [box.trackId, box.label, posed.size])

  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    if (
      transformGizmoState.dragging &&
      transformGizmoState.draggingNodeId === box.trackId
    ) {
      return
    }
    g.position.set(posed.position[0], posed.position[1], posed.position[2])
    g.quaternion.set(
      posed.quaternion[0],
      posed.quaternion[1],
      posed.quaternion[2],
      posed.quaternion[3],
    )
    g.scale.set(1, 1, 1)
    g.userData.annotationBaseSize = posed.size
    g.userData.annotationLabel = box.label
  }, [posed, box.trackId, box.label])

  const hoverData = {
    annotationTrackId: box.trackId,
    annotationLabel: box.label,
    annotationSource: 'editable' as const,
  }

  return (
    <group ref={groupRef} userData={hoverData}>
      <mesh ref={meshRef} geometry={boxGeo} userData={hoverData}>
        <meshBasicMaterial
          color={posed.color}
          transparent
          opacity={posed.fillOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <lineSegments geometry={edgesGeo} userData={hoverData}>
        <lineBasicMaterial
          color={posed.color}
          transparent
          opacity={posed.edgeOpacity}
          toneMapped={false}
          depthTest
        />
      </lineSegments>
    </group>
  )
}

/** Editable annotation tracks sampled at playhead (ROS under ROS→Three). */
export function EditableAnnotationBoxes() {
  const boxes = useAtomValue(sampledAnnotationsAtPlayheadAtom)
  const selectedId = useAtomValue(selectedTrackIdAtom)
  const tfGen = useTfGeneration()
  const lidarFrameId = useLidarFrameId()
  const displayFrame = lidarFrameId || getPlaybackCloudFrameId()
  const groundLiftY = useMemo(() => getPlaybackGroundLiftY(), [tfGen, lidarFrameId])

  if (boxes.length === 0) return null

  return (
    <group name="editable-annotations" position={[0, groundLiftY, 0]}>
      <group quaternion={ROS_TO_THREE_Q}>
        {boxes.map((box) => (
          <EditableBox
            key={box.trackId}
            box={box}
            displayFrame={displayFrame}
            selected={box.trackId === selectedId}
            tfGen={tfGen}
          />
        ))}
      </group>
    </group>
  )
}
