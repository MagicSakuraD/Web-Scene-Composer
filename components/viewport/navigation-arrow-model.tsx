'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export const NAV_WAYPOINT_MODEL_URL = '/models/NavigationArrow.glb'

/**
 * Nav2 目标点：public/models/NavigationArrow.glb
 * - 缩小 10 倍
 * - 绕 Y 顺时针 90°（Three.js 正旋转为 CCW，故用 -π/2）
 */
export function NavigationArrowModel() {
  const { scene } = useGLTF(NAV_WAYPOINT_MODEL_URL)
  const clone = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = false
        obj.receiveShadow = false
      }
    })
    return c
  }, [scene])

  return (
    <group scale={0.2} rotation={[0, -Math.PI / 2, 0]}>
      <primitive object={clone} />
    </group>
  )
}

useGLTF.preload(NAV_WAYPOINT_MODEL_URL)
