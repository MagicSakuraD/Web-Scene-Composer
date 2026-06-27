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
import { createLidarShaderMaterial, type LidarShaderMaterial } from '@/lib/ros/lidar-shader'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { resolveRobotAnimRoot } from '@/lib/ros/caster-swivel'
import { findLidarMountNode } from '@/lib/ros/resolve-lidar-mount'

/**
 * 在 rosPointsToThreeBuffer 之后，对点云局部坐标再绕 X 轴旋转（弧度）。
 * +Math.PI/2 = 绕 X 轴 +90°；-Math.PI/2 = -90°；0 = 不额外旋转。
 * 调这个值修正「竖拱门」；改完保存刷新即可。
 */
const LIDAR_EXTRA_ROTATION_X = Math.PI / 2

/**
 * Nova Carter 3D 雷达点云
 * - 坐标：rosPointsToThreeBuffer（Isaac Z-up → Three Y-up）
 * - 设色：Turbo Shader 按 height(Y) 在 GPU 内算色，无 CPU 逐点设色
 * - 外参：attach 到 glTF front_RPLidar
 */
export function LidarPointCloud() {
  const config = useAtomValue(lidarDisplayAtom)
  const status = useAtomValue(simulateStatusAtom)
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const cloudGroupRef = useRef<THREE.Group>(null)
  const attachedMountRef = useRef<THREE.Object3D | null>(null)
  const lastGenerationRef = useRef(0)

  const material = useMemo(() => createLidarShaderMaterial(), [])

  const simActive = status === 'connected'

  useFrame(() => {
    if (!config.visible || !simActive) return

    const mat = material as LidarShaderMaterial
    mat.uniforms.uPointSize.value = config.pointSize
    mat.uniforms.uOpacity.value = config.opacity
    mat.uniforms.uSizeAttenuation.value = config.sizeAttenuation ? 1 : 0
    mat.uniforms.uUseGradient.value = config.colorMode === 'turbo' ? 1 : 0
    mat.uniforms.uSolidColor.value.set(config.color)
    mat.uniforms.uEmissiveBoost.value = 1

    const minY = config.heightMin ?? lidarPointStore.heightMin
    const maxY = config.heightMax ?? lidarPointStore.heightMax
    mat.uniforms.uMinY.value = minY
    mat.uniforms.uMaxY.value = maxY

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

    const points = pointsRef.current
    const cloudGroup = cloudGroupRef.current
    if (!points || !cloudGroup || !config.followRobot) return

    const targetId = runtimePoseStore.robotNodeId
    if (!targetId) return
    const obj = objectByNodeId.get(targetId)
    if (!obj) return

    const animRoot = resolveRobotAnimRoot(obj)
    animRoot.updateMatrixWorld(true)
    const mount = findLidarMountNode(animRoot)
    if (!mount) return

    if (attachedMountRef.current !== mount) {
      mount.attach(cloudGroup)
      attachedMountRef.current = mount
    }
  })

  if (!config.visible) return null

  return (
    <group ref={cloudGroupRef} rotation={[LIDAR_EXTRA_ROTATION_X, 0, 0]}>
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
  )
}
