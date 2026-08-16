'use client'

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneEntityStore } from '@/lib/ros/scene-entity-store'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { applyDisplayPoseToObject } from '@/lib/ros/annotation-frame'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import {
  getPlaybackCloudFrameId,
  getPlaybackGroundLiftY,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import { setSceneAnnotationPickRoot } from '@/lib/annotations/object-registry'

const MAX_SCENE_CUBES = 512
const EDGE_VERTS_PER_CUBE = 24
const EDGE_FLOATS = MAX_SCENE_CUBES * EDGE_VERTS_PER_CUBE * 3
const EDGE_COLORS = MAX_SCENE_CUBES * EDGE_VERTS_PER_CUBE * 3

/** Unit cube (-0.5..0.5) 12 edges × 2 verts */
const UNIT_CUBE_EDGES = new Float32Array([
  -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5,
  0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5,
  0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
])

const _dummy = new THREE.Object3D()
const _edgeV = new THREE.Vector3()
const _color = new THREE.Color()
const _noopRaycast: THREE.Object3D['raycast'] = () => {}

function isFiniteVec3(x: number, y: number, z: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
}

function writeCubeEdges(matrix: THREE.Matrix4, dst: Float32Array, offset: number) {
  for (let i = 0; i < EDGE_VERTS_PER_CUBE; i++) {
    const i3 = i * 3
    _edgeV
      .set(UNIT_CUBE_EDGES[i3], UNIT_CUBE_EDGES[i3 + 1], UNIT_CUBE_EDGES[i3 + 2])
      .applyMatrix4(matrix)
    dst[offset + i3] = _edgeV.x
    dst[offset + i3 + 1] = _edgeV.y
    dst[offset + i3 + 2] = _edgeV.z
  }
}

/**
 * foxglove.SceneUpdate cubes — InstancedMesh + batched edges, poses mutated in useFrame.
 * Same display frame as playback lidar (LIDAR_TOP).
 */
export function SceneAnnotationCubes() {
  const liftRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const edgesRef = useRef<THREE.LineSegments>(null)
  const lastEntityGen = useRef(-1)
  const lastTfGen = useRef(-1)
  const lastLidarFrame = useRef('')
  const labelsRef = useRef<string[]>([])

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const fillMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )
  const edgePositions = useMemo(() => new Float32Array(EDGE_FLOATS), [])
  const edgeColors = useMemo(() => new Float32Array(EDGE_COLORS), [])
  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
        depthTest: true,
      }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    const edges = edgesRef.current
    if (edges) edges.raycast = _noopRaycast
    if (mesh) {
      mesh.userData.annotationSource = 'scene-update'
      mesh.userData.annotationTopic = '/markers/annotations'
      mesh.userData.annotationInstanceLabels = labelsRef.current
      setSceneAnnotationPickRoot(mesh)
    }
    return () => setSceneAnnotationPickRoot(null)
  }, [])

  useEffect(() => {
    return () => {
      boxGeo.dispose()
      fillMat.dispose()
      edgeMat.dispose()
    }
  }, [boxGeo, fillMat, edgeMat])

  useFrame(() => {
    const mesh = meshRef.current
    const edges = edgesRef.current
    const lift = liftRef.current
    if (!mesh || !edges || !lift) return

    const snap = sceneEntityStore.getSnapshot()
    const lidarFrame = lidarPointStore.frameId
    const entityGen = snap.generation
    const currentTfGen = tfRuntimeStore.generation

    if (
      entityGen === lastEntityGen.current &&
      currentTfGen === lastTfGen.current &&
      lidarFrame === lastLidarFrame.current
    ) {
      return
    }
    lastEntityGen.current = entityGen
    lastTfGen.current = currentTfGen
    lastLidarFrame.current = lidarFrame

    lift.position.set(0, getPlaybackGroundLiftY(), 0)
    const displayFrame = lidarFrame || getPlaybackCloudFrameId()
    const cubes = snap.cubes
    const n = Math.min(cubes.length, MAX_SCENE_CUBES)
    const labels = labelsRef.current
    labels.length = n

    const posAttr = edges.geometry.attributes.position as THREE.BufferAttribute
    const colorAttr = edges.geometry.attributes.color as THREE.BufferAttribute

    for (let i = 0; i < n; i++) {
      const cube = cubes[i]
      const [sx0, sy0, sz0] = cube.size
      const sx = Math.max(1e-3, Math.abs(sx0) || 1e-3)
      const sy = Math.max(1e-3, Math.abs(sy0) || 1e-3)
      const sz = Math.max(1e-3, Math.abs(sz0) || 1e-3)
      if (!isFiniteVec3(cube.position[0], cube.position[1], cube.position[2])) {
        _dummy.scale.set(0, 0, 0)
        _dummy.position.set(0, 0, 0)
        _dummy.quaternion.identity()
        _dummy.updateMatrix()
        mesh.setMatrixAt(i, _dummy.matrix)
        labels[i] = ''
        continue
      }

      applyDisplayPoseToObject(
        cube.frameId || 'map',
        displayFrame,
        cube.position,
        cube.orientation,
        _dummy,
      )
      _dummy.scale.set(sx, sy, sz)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      const [r, g, b] = cube.color
      _color.setRGB(
        Number.isFinite(r) ? r : 1,
        Number.isFinite(g) ? g : 0.6,
        Number.isFinite(b) ? b : 0.2,
      )
      mesh.setColorAt(i, _color)

      writeCubeEdges(_dummy.matrix, edgePositions, i * EDGE_VERTS_PER_CUBE * 3)
      const cOff = i * EDGE_VERTS_PER_CUBE * 3
      for (let v = 0; v < EDGE_VERTS_PER_CUBE; v++) {
        const o = cOff + v * 3
        edgeColors[o] = _color.r
        edgeColors[o + 1] = _color.g
        edgeColors[o + 2] = _color.b
      }

      labels[i] =
        cube.metadata?.category ??
        cube.metadata?.label ??
        cube.metadata?.class ??
        cube.entityId
    }

    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.visible = n > 0
    mesh.userData.annotationInstanceLabels = labels

    posAttr.needsUpdate = true
    colorAttr.needsUpdate = true
    edges.geometry.setDrawRange(0, n * EDGE_VERTS_PER_CUBE)
    edges.visible = n > 0
  })

  return (
    <group ref={liftRef} name="scene-annotations">
      <group quaternion={ROS_TO_THREE_Q}>
        <instancedMesh
          ref={meshRef}
          args={[boxGeo, fillMat, MAX_SCENE_CUBES]}
          frustumCulled={false}
          visible={false}
        />
        <lineSegments ref={edgesRef} frustumCulled={false} visible={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[edgePositions, 3]}
              usage={THREE.DynamicDrawUsage}
            />
            <bufferAttribute
              attach="attributes-color"
              args={[edgeColors, 3]}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <primitive object={edgeMat} attach="material" />
        </lineSegments>
      </group>
    </group>
  )
}
