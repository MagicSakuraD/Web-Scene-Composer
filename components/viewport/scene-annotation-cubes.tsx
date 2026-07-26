'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import {
  sceneEntityStore,
  type SceneEntitySnapshot,
} from '@/lib/ros/scene-entity-store'
import type { DecodedSceneCube } from '@/lib/mcap/foxglove-scene-update-decode'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import {
  getPlaybackCloudFrameId,
  getPlaybackGroundLiftY,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

function useSceneEntitySnapshot(): SceneEntitySnapshot {
  return useSyncExternalStore(
    (onStoreChange) => sceneEntityStore.subscribe(onStoreChange),
    () => sceneEntityStore.getSnapshot(),
    () => sceneEntityStore.getSnapshot(),
  )
}

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

function applyRosPose(
  T: RosTransform,
  position: [number, number, number],
  orientation: [number, number, number, number],
): { position: [number, number, number]; orientation: [number, number, number, number] } {
  const qT = new THREE.Quaternion(
    T.rotation.x,
    T.rotation.y,
    T.rotation.z,
    T.rotation.w,
  )
  const p = new THREE.Vector3(position[0], position[1], position[2]).applyQuaternion(qT)
  p.x += T.translation.x
  p.y += T.translation.y
  p.z += T.translation.z
  const q = qT
    .clone()
    .multiply(
      new THREE.Quaternion(orientation[0], orientation[1], orientation[2], orientation[3]),
    )
  return {
    position: [p.x, p.y, p.z],
    orientation: [q.x, q.y, q.z, q.w],
  }
}

/** Transform cube from its frame_id into the active cloud frame (ROS). */
function resolveDisplayPose(
  cube: DecodedSceneCube,
  displayFrame: string,
): { position: [number, number, number]; orientation: [number, number, number, number] } {
  const sourceFrame = cube.frameId || 'map'
  if (displayFrame && sourceFrame && displayFrame !== sourceFrame) {
    const T = tfRuntimeStore.lookupTransform(displayFrame, sourceFrame)
    if (T) return applyRosPose(T, cube.position, cube.orientation)
  }
  return { position: cube.position, orientation: cube.orientation }
}

function isFiniteVec3(v: [number, number, number]): boolean {
  return v.every((n) => Number.isFinite(n))
}

function AnnotationCube({
  cube,
  displayFrame,
  tfGen,
}: {
  cube: DecodedSceneCube
  displayFrame: string
  tfGen: number
}) {
  const posed = useMemo(() => {
    const p = resolveDisplayPose(cube, displayFrame)
    const [sx, sy, sz] = cube.size
    const size: [number, number, number] = [
      Math.max(1e-3, Math.abs(sx) || 1e-3),
      Math.max(1e-3, Math.abs(sy) || 1e-3),
      Math.max(1e-3, Math.abs(sz) || 1e-3),
    ]
    if (!isFiniteVec3(p.position) || !isFiniteVec3(size)) return null
    const [r, g, b, a] = cube.color
    const fill = Number.isFinite(a) ? Math.min(0.32, Math.max(0.1, a * 0.55)) : 0.18
    return {
      position: p.position,
      quaternion: p.orientation,
      size,
      color: new THREE.Color(
        Number.isFinite(r) ? r : 1,
        Number.isFinite(g) ? g : 0.6,
        Number.isFinite(b) ? b : 0.2,
      ),
      fillOpacity: fill,
      edgeOpacity: Math.min(1, Math.max(0.7, (Number.isFinite(a) ? a : 0.5) + 0.35)),
    }
  }, [cube, displayFrame, tfGen])

  const { boxGeo, edgesGeo } = useMemo(() => {
    if (!posed) return { boxGeo: null, edgesGeo: null }
    const box = new THREE.BoxGeometry(posed.size[0], posed.size[1], posed.size[2])
    const edges = new THREE.EdgesGeometry(box)
    return { boxGeo: box, edgesGeo: edges }
  }, [posed])

  useEffect(() => {
    return () => {
      boxGeo?.dispose()
      edgesGeo?.dispose()
    }
  }, [boxGeo, edgesGeo])

  if (!posed || !boxGeo || !edgesGeo) return null

  const category =
    cube.metadata?.category ??
    cube.metadata?.label ??
    cube.metadata?.class ??
    cube.entityId
  const hoverData = {
    annotationLabel: category,
    annotationTopic: '/markers/annotations',
    annotationSource: 'scene-update' as const,
  }

  return (
    <group position={posed.position} quaternion={posed.quaternion} userData={hoverData}>
      <mesh geometry={boxGeo} userData={hoverData}>
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

/**
 * foxglove.SceneUpdate cubes — same frame as playback lidar (LIDAR_TOP),
 * so NuScenes ~90° lidar yaw / 1.84m height stay consistent with the cloud.
 */
export function SceneAnnotationCubes() {
  const snapshot = useSceneEntitySnapshot()
  const tfGen = useTfGeneration()
  const lidarFrameId = useLidarFrameId()

  const displayFrame = lidarFrameId || getPlaybackCloudFrameId()
  const groundLiftY = useMemo(() => getPlaybackGroundLiftY(), [tfGen, lidarFrameId])

  if (snapshot.cubes.length === 0) return null

  return (
    <group name="scene-annotations" position={[0, groundLiftY, 0]}>
      <group quaternion={ROS_TO_THREE_Q}>
        {snapshot.cubes.map((cube, i) => (
          <AnnotationCube
            key={`${cube.entityId}-${i}`}
            cube={cube}
            displayFrame={displayFrame}
            tfGen={tfGen}
          />
        ))}
      </group>
    </group>
  )
}
