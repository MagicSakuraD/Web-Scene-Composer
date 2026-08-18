'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export const NAV_WAYPOINT_MODEL_URL = '/models/NavigationArrow.glb'

function tintMaterial(mat: THREE.Material, color: string) {
  const cloned = mat.clone()
  if (
    cloned instanceof THREE.MeshStandardMaterial ||
    cloned instanceof THREE.MeshPhysicalMaterial ||
    cloned instanceof THREE.MeshPhongMaterial ||
    cloned instanceof THREE.MeshLambertMaterial ||
    cloned instanceof THREE.MeshBasicMaterial
  ) {
    cloned.color.set(color)
  }
  if ('emissive' in cloned && cloned.emissive instanceof THREE.Color) {
    cloned.emissive.set(color)
    if ('emissiveIntensity' in cloned) cloned.emissiveIntensity = 0.22
  }
  return cloned
}

/**
 * Nav2 / 货架作业目标点：public/models/NavigationArrow.glb
 * - 缩小
 * - 绕 Y 顺时针 90°（Three.js 正旋转为 CCW，故用 -π/2）
 * - color 用于取货（绿）/ 卸货（红）；不传则保持模型原色
 */
export function NavigationArrowModel({ color }: { color?: string }) {
  const { scene } = useGLTF(NAV_WAYPOINT_MODEL_URL)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      obj.castShadow = false
      obj.receiveShadow = false
      if (!color) return
      obj.material = Array.isArray(obj.material)
        ? obj.material.map((m) => tintMaterial(m, color))
        : tintMaterial(obj.material, color)
    })
    return c
  }, [scene, color])

  return (
    <group scale={0.2} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={clone} />
    </group>
  )
}

useGLTF.preload(NAV_WAYPOINT_MODEL_URL)
