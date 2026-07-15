'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { lidarDisplayAtom, simulateStatusAtom } from '@/lib/ros/atoms'
import {
  LIDAR_MAX_POINTS,
  LIDAR_POSITION_BUFFER,
  lidarPointStore,
} from '@/lib/ros/lidar-point-store'
import {
  createLidarTslMaterial,
  colorModeToGradientMode,
  setLidarSolidColor,
  type LidarTslUniforms,
} from '@/lib/ros/lidar-tsl-material'
import { applyLidarCloudMount } from '@/lib/ros/apply-lidar-mount'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { resolveRobotAnimRoot } from '@/lib/ros/caster-swivel'

/**
 * Nova Carter 3D 雷达点云（WebGPU / TSL）
 * - 挂载：优先 glTF `XT_32`（ROS frame front_3d_lidar）→ /tf → 话题回退
 * - 点坐标：雷达系 local，经 rosPointsToThreeBuffer 转 Three.js
 * - 轴向：默认绕局部 X +90°（见 lidar-config.ts）；面板请用「默认」恢复，勿长期手调 X/Y
 */
export function LidarPointCloud() {
  const config = useAtomValue(lidarDisplayAtom)
  const status = useAtomValue(simulateStatusAtom)
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const mountGroupRef = useRef<THREE.Group>(null)
  const orientGroupRef = useRef<THREE.Group>(null)
  const mountModeRef = useRef<'frame' | 'tf' | 'gltf' | null>(null)
  const lastGenerationRef = useRef(0)
  const solidColorScratch = useMemo(() => new THREE.Color(), [])

  const { material, uniforms } = useMemo(() => createLidarTslMaterial(), [])

  const simActive = status === 'connected'

  useFrame(() => {
    if (!config.visible || !simActive) return

    updateLidarUniforms(uniforms, config, solidColorScratch)

    const gen = lidarPointStore.generation
    if (gen !== lastGenerationRef.current && geometryRef.current && lidarPointStore.pointCount > 0) {
      lastGenerationRef.current = gen
      const geo = geometryRef.current
      const attr = geo.attributes.position as THREE.BufferAttribute
      const n = lidarPointStore.pointCount * 3
      attr.array.set(LIDAR_POSITION_BUFFER.subarray(0, n))
      attr.needsUpdate = true
      geo.setDrawRange(0, lidarPointStore.pointCount)
    }

    const mountGroup = mountGroupRef.current
    if (!mountGroup || !config.followRobot) return

    const targetId = runtimePoseStore.robotNodeId
    if (!targetId) return
    const obj = objectByNodeId.get(targetId)
    if (!obj) return

    const animRoot = resolveRobotAnimRoot(obj)
    animRoot.updateMatrixWorld(true)

    const frameId = lidarPointStore.frameId || 'front_3d_lidar'
    mountModeRef.current = applyLidarCloudMount(
      mountGroup,
      animRoot,
      frameId,
      config.topic,
    )
  })

  if (!config.visible) return null

  return (
    <group ref={mountGroupRef}>
      <group
        ref={orientGroupRef}
        rotation={[config.extraRotationX, config.extraRotationY, 0]}
      >
        <points ref={pointsRef} material={material}>
          <bufferGeometry ref={geometryRef}>
            <bufferAttribute
              attach="attributes-position"
              count={LIDAR_MAX_POINTS}
              array={LIDAR_POSITION_BUFFER}
              itemSize={3}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
        </points>
      </group>
    </group>
  )
}

function updateLidarUniforms(
  uniforms: LidarTslUniforms,
  config: {
    opacity: number
    colorMode: string
    color: string
  },
  solidScratch: THREE.Color,
) {
  uniforms.uOpacity.value = config.opacity
  uniforms.uGradientMode.value = colorModeToGradientMode(
    config.colorMode as 'distance' | 'turbo' | 'solid',
  )
  setLidarSolidColor(uniforms, config.color, solidScratch)

  uniforms.uMinY.value = lidarPointStore.heightMin
  uniforms.uMaxY.value = lidarPointStore.heightMax
  uniforms.uMinDist.value = lidarPointStore.distMin
  uniforms.uMaxDist.value = lidarPointStore.distMax
  uniforms.uEmissiveBoost.value = 1
}
