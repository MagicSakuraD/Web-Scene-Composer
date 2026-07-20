'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { viewportShadingAtom, type ViewportShading } from '@/lib/viewport/atoms'

function createOverrideMaterial(mode: ViewportShading): THREE.Material | null {
  switch (mode) {
    case 'solid':
      return new THREE.MeshStandardMaterial({
        color: 0xb0b0b0,
        roughness: 0.85,
        metalness: 0.05,
        flatShading: false,
      })
    case 'wireframe':
      // 深色背景用浅色线框更易读
      return new THREE.MeshBasicMaterial({
        color: 0xd4d4d8,
        wireframe: true,
      })
    case 'normals':
      return new THREE.MeshNormalMaterial()
    case 'shaded':
    default:
      return null
  }
}

/**
 * 仿 three.js editor：用 scene.overrideMaterial 切换视口着色。
 * 不改场景材质、不进撤销栈；切模式时 dispose 旧 override。
 */
export function ViewportShading() {
  const shading = useAtomValue(viewportShadingAtom)
  const scene = useThree((s) => s.scene)
  const materialRef = useRef<THREE.Material | null>(null)

  useEffect(() => {
    materialRef.current?.dispose()
    materialRef.current = null

    const mat = createOverrideMaterial(shading)
    materialRef.current = mat
    scene.overrideMaterial = mat

    return () => {
      if (scene.overrideMaterial === mat) {
        scene.overrideMaterial = null
      }
      mat?.dispose()
      if (materialRef.current === mat) materialRef.current = null
    }
  }, [scene, shading])

  return null
}
