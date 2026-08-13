'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import {
  cameraFrustumByTopicAtom,
  DEFAULT_CAMERA_FRUSTUM,
  tfDisplayAtom,
} from '@/lib/ros/atoms'
import {
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import { cameraInfoStore } from '@/lib/ros/camera-info-store'
import { cameraFrameStore } from '@/lib/ros/camera-frame-store'
import { computeFrustumCorners } from '@/lib/ros/camera-frustum-math'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import {
  getSceneGroundLiftY,
  resolveSceneFixedFrame,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
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

function identityT(): RosTransform {
  return {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function buildOpticalFrustumGeometry(
  infoTopic: string,
  distance: number,
  planarFactor: number,
): { wireGeo: THREE.BufferGeometry; quadGeo: THREE.BufferGeometry } | null {
  const info = cameraInfoStore.get(infoTopic)
  if (!info) return null
  const cornersRos = computeFrustumCorners(info, distance, planarFactor)
  if (!cornersRos) return null

  const { origin, corners } = cornersRos
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

  const [tl, tr, br, bl] = corners
  const quadPositions = new Float32Array([...tl, ...tr, ...br, ...bl])
  const quadUvs = new Float32Array([0, 1, 1, 1, 1, 0, 0, 0])
  const quadIndices = new Uint16Array([0, 1, 2, 0, 2, 3])
  const quadGeo = new THREE.BufferGeometry()
  quadGeo.setAttribute('position', new THREE.BufferAttribute(quadPositions, 3))
  quadGeo.setAttribute('uv', new THREE.BufferAttribute(quadUvs, 2))
  quadGeo.setIndex(new THREE.BufferAttribute(quadIndices, 1))

  return { wireGeo, quadGeo }
}

/**
 * WebGPU 下 CanvasTexture 常常不刷新 2D 绘制；用普通 Texture + ImageBitmap 拷贝更稳。
 */
function useFrustumImageTexture(imageTopic: string | null, enabled: boolean) {
  const frameGen = useCameraFrameGeneration(enabled ? imageTopic : null)
  const textureRef = useRef<THREE.Texture | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastGen = useRef(0)
  const ownedBitmapRef = useRef<ImageBitmap | null>(null)
  const [texReady, setTexReady] = useState(false)

  useEffect(() => {
    const tex = new THREE.Texture()
    tex.colorSpace = THREE.SRGBColorSpace
    tex.flipY = true
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    textureRef.current = tex
    return () => {
      tex.dispose()
      textureRef.current = null
    }
  }, [])

  useEffect(() => {
    setTexReady(false)
    lastGen.current = 0
    if (!enabled || !imageTopic) return

    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 2
    canvasRef.current = canvas
    const unreg = cameraFrameStore.registerCanvas(imageTopic, canvas)
    return () => {
      unreg()
      canvasRef.current = null
      const owned = ownedBitmapRef.current
      if (owned) {
        owned.close()
        ownedBitmapRef.current = null
      }
    }
  }, [imageTopic, enabled])

  useFrame(() => {
    if (!enabled || !imageTopic || !textureRef.current) return
    if (frameGen === lastGen.current || frameGen === 0) return
    const canvas = canvasRef.current
    if (!canvas || canvas.width < 2 || canvas.height < 2) return

    const capturedGen = frameGen
    lastGen.current = capturedGen
    const tex = textureRef.current
    void createImageBitmap(canvas).then((bmp) => {
      if (lastGen.current !== capturedGen || textureRef.current !== tex) {
        bmp.close()
        return
      }
      const prev = ownedBitmapRef.current
      ownedBitmapRef.current = bmp
      tex.image = bmp
      tex.needsUpdate = true
      if (tex.source) tex.source.needsUpdate = true
      setTexReady(true)
      if (prev) prev.close()
    })
  })

  return enabled && texReady ? textureRef.current : null
}

function CameraFrustumMesh({
  infoTopic,
  imageTopic,
  imageVisible,
  displayFrame,
}: {
  infoTopic: string
  imageTopic: string | null
  imageVisible: boolean
  displayFrame: string
}) {
  const settings =
    useAtomValue(cameraFrustumByTopicAtom)[infoTopic] ?? DEFAULT_CAMERA_FRUSTUM
  const infoGen = useCameraInfoGeneration()
  const tfGen = useTfGeneration()

  const showTexture = Boolean(imageTopic && imageVisible)
  const texture = useFrustumImageTexture(imageTopic, showTexture)

  const info = cameraInfoStore.get(infoTopic)
  const sourceFrame = info?.frameId || displayFrame

  const poseT = useMemo(() => {
    if (!displayFrame || !sourceFrame || displayFrame === sourceFrame) {
      return identityT()
    }
    return tfRuntimeStore.lookupTransform(displayFrame, sourceFrame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayFrame, sourceFrame, tfGen, infoGen])

  const geometryBundle = useMemo(
    () => {
      if (!settings.enabled) return null
      return buildOpticalFrustumGeometry(
        infoTopic,
        settings.distance,
        settings.planarFactor,
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [infoTopic, settings.enabled, settings.distance, settings.planarFactor, infoGen],
  )

  useEffect(() => {
    return () => {
      geometryBundle?.wireGeo.dispose()
      geometryBundle?.quadGeo.dispose()
    }
  }, [geometryBundle])

  if (!geometryBundle || !settings.enabled || !poseT) return null

  const wireColor = new THREE.Color(settings.wireColor)
  const q = new THREE.Quaternion(
    poseT.rotation.x,
    poseT.rotation.y,
    poseT.rotation.z,
    poseT.rotation.w,
  )

  return (
    <group
      position={[
        poseT.translation.x,
        poseT.translation.y,
        poseT.translation.z,
      ]}
      quaternion={q}
    >
      <lineSegments geometry={geometryBundle.wireGeo}>
        <lineBasicMaterial
          color={wireColor}
          toneMapped={false}
          depthTest
          transparent
          opacity={0.95}
        />
      </lineSegments>
      {showTexture && texture ? (
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
      ) : null}
    </group>
  )
}

/** Foxglove-style CameraInfo frustum；图像贴图仅在图像话题眼睛开启时显示 */
export function CameraFrustumProjections() {
  const frustumByTopic = useAtomValue(cameraFrustumByTopicAtom)
  const topics = useAtomValue(mcapTopicsAtom)
  const visibility = useAtomValue(topicVisibilityAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const tfConfig = useAtomValue(tfDisplayAtom)
  const lidarFrameId = useLidarFrameId()
  const tfGen = useTfGeneration()

  const displayFrame = useMemo(
    () =>
      resolveSceneFixedFrame({
        configured: tfConfig.fixedFrame,
        dataSourceMode,
        lidarFrameId,
      }),
    [tfConfig.fixedFrame, dataSourceMode, lidarFrameId, tfGen],
  )

  const groundLiftY = useMemo(
    () => getSceneGroundLiftY(dataSourceMode),
    [tfGen, lidarFrameId, dataSourceMode],
  )
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
        {enabled.map((infoTopic) => {
          const imageTopic = resolveImageTopicForInfo(infoTopic, availableTopics)
          const imageVisible = imageTopic != null && visibility[imageTopic] === true
          return (
            <CameraFrustumMesh
              key={infoTopic}
              infoTopic={infoTopic}
              imageTopic={imageTopic}
              imageVisible={imageVisible}
              displayFrame={displayFrame}
            />
          )
        })}
      </group>
    </group>
  )
}
