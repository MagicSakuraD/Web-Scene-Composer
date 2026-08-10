'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import {
  cameraFrustumByTopicAtom,
  DEFAULT_CAMERA_FRUSTUM,
} from '@/lib/ros/atoms'
import { cameraInfoStore } from '@/lib/ros/camera-info-store'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'
import { computeFrustumCorners } from '@/lib/ros/camera-frustum-math'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import {
  getPlaybackCloudFrameId,
  getPlaybackGroundLiftY,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import { mcapTopicsAtom } from '@/lib/playback/atoms'
import { resolveImageTopicForInfo } from '@/lib/ros/resolve-camera-topics'

function useCameraInfoGeneration(): number {
  return useSyncExternalStore(
    (cb) => cameraInfoStore.subscribe(cb),
    () => cameraInfoStore.generation,
    () => cameraInfoStore.generation,
  )
}

function useCameraFrameGeneration(topic: string | null): number {
  return useSyncExternalStore(
    (cb) => cameraFrameStore.subscribe(cb),
    () => (topic ? (cameraFrameStore.getFrame(topic)?.generation ?? 0) : 0),
    () => (topic ? (cameraFrameStore.getFrame(topic)?.generation ?? 0) : 0),
  )
}

function useTfGeneration(): number {
  return useSyncExternalStore(
    (cb) => tfRuntimeStore.subscribe(cb),
    () => tfRuntimeStore.generation,
    () => tfRuntimeStore.generation,
  )
}

function useLidarFrameId(): string {
  return useSyncExternalStore(
    (cb) => lidarPointStore.subscribe(cb),
    () => lidarPointStore.getSnapshot().frameId,
    () => lidarPointStore.getSnapshot().frameId,
  )
}

function transformPoint(
  T: RosTransform,
  p: [number, number, number],
): [number, number, number] {
  const q = new THREE.Quaternion(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
  const v = new THREE.Vector3(p[0], p[1], p[2]).applyQuaternion(q)
  return [v.x + T.translation.x, v.y + T.translation.y, v.z + T.translation.z]
}

function identityT(): RosTransform {
  return {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function CameraFrustumMesh({
  infoTopic,
  imageTopic,
  displayFrame,
}: {
  infoTopic: string
  imageTopic: string | null
  displayFrame: string
}) {
  const settings =
    useAtomValue(cameraFrustumByTopicAtom)[infoTopic] ?? DEFAULT_CAMERA_FRUSTUM
  const infoGen = useCameraInfoGeneration()
  const frameGen = useCameraFrameGeneration(imageTopic)
  const tfGen = useTfGeneration()

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const lastPaintedGen = useRef(0)

  const geometryBundle = useMemo(() => {
    const info = cameraInfoStore.get(infoTopic)
    if (!info || !settings.enabled) return null

    const cornersRos = computeFrustumCorners(
      info,
      settings.distance,
      settings.planarFactor,
    )
    if (!cornersRos) return null

    const sourceFrame = info.frameId || displayFrame
    const T =
      displayFrame && sourceFrame && displayFrame !== sourceFrame
        ? (tfRuntimeStore.lookupTransform(displayFrame, sourceFrame) ?? identityT())
        : identityT()

    const origin = transformPoint(T, cornersRos.origin)
    const corners = cornersRos.corners.map((c) => transformPoint(T, c)) as [
      [number, number, number],
      [number, number, number],
      [number, number, number],
      [number, number, number],
    ]

    // Wire: origin→corners + image rectangle
    const wirePositions = new Float32Array([
      ...origin,
      ...corners[0],
      ...origin,
      ...corners[1],
      ...origin,
      ...corners[2],
      ...origin,
      ...corners[3],
      ...corners[0],
      ...corners[1],
      ...corners[1],
      ...corners[2],
      ...corners[2],
      ...corners[3],
      ...corners[3],
      ...corners[0],
    ])
    const wireGeo = new THREE.BufferGeometry()
    wireGeo.setAttribute('position', new THREE.BufferAttribute(wirePositions, 3))

    // Quad: TL TR BR BL → triangles 0-1-2, 0-2-3
    const [tl, tr, br, bl] = corners
    const quadPositions = new Float32Array([
      ...tl,
      ...tr,
      ...br,
      ...bl,
    ])
    const quadUvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
    const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3])
    const quadGeo = new THREE.BufferGeometry()
    quadGeo.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3))
    quadGeo.setAttribute('uv', new THREE.BufferAttribute(quadUvs, 2))
    quadGeo.setIndex(new THREE.BufferAttribute(quadIndices, 1))

    return { wireGeo, quadGeo }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional store/tf gens
  }, [
    infoTopic,
    displayFrame,
    settings.enabled,
    settings.distance,
    settings.planarFactor,
    infoGen,
    tfGen,
  ])

  useEffect(() => {
    return () => {
      geometryBundle?.wireGeo.dispose()
      geometryBundle?.quadGeo.dispose()
    }
  }, [geometryBundle])

  useEffect(() => {
    if (!imageTopic) {
      setTexture(null)
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    canvasRef.current = canvas
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = true
    setTexture(tex)
    const unreg = cameraFrameStore.registerCanvas(imageTopic, canvas)
    lastPaintedGen.current = 0
    return () => {
      unreg()
      tex.dispose()
      setTexture(null)
      canvasRef.current = null
    }
  }, [imageTopic])

  useFrame(() => {
    if (!texture || !imageTopic) return
    if (frameGen !== lastPaintedGen.current) {
      lastPaintedGen.current = frameGen
      texture.needsUpdate = true
    }
  })

  if (!geometryBundle || !settings.enabled) return null

  const wireColor = new THREE.Color(settings.wireColor)

  return (
    <group>
      <lineSegments geometry={geometryBundle.wireGeo}>
        <lineBasicMaterial
          color={wireColor}
          toneMapped={false}
          depthTest
          transparent
          opacity={0.95}
        />
      </lineSegments>
      <mesh geometry={geometryBundle.quadGeo}>
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={settings.imageOpacity}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/** Foxglove-style CameraInfo frustum + textured image plane in the lidar display frame */
export function CameraFrustumProjections() {
  const frustumByTopic = useAtomValue(cameraFrustumByTopicAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const lidarFrameId = useLidarFrameId()
  const tfGen = useTfGeneration()

  const displayFrame = lidarFrameId || getPlaybackCloudFrameId()
  const groundLiftY = useMemo(() => getPlaybackGroundLiftY(), [tfGen, lidarFrameId])
  const availableTopics = useMemo(() => topics.map((t) => t.topic), [topics])

  const enabled = useMemo(
    () =>
      Object.entries(frustumByTopic)
        .filter(([, s]) => s.enabled)
        .map(([topic]) => topic),
    [frustumByTopic],
  )

  if (enabled.length === 0) return null

  return (
    <group name="camera-frustums" position={[0, groundLiftY, 0]}>
      <group quaternion={ROS_TO_THREE_Q}>
        {enabled.map((infoTopic) => (
          <CameraFrustumMesh
            key={infoTopic}
            infoTopic={infoTopic}
            imageTopic={resolveImageTopicForInfo(infoTopic, availableTopics)}
            displayFrame={displayFrame}
          />
        ))}
      </group>
    </group>
  )
}
