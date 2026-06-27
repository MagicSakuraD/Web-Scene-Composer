'use client'

import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import type { SceneNode } from '@/lib/scene/types'
import { PHYSICAL_LIGHTS_CONFIG } from '@/lib/viewport/visual-config'

/** Sun / 场景树中的 physical-distant-light 节点 */
export function PhysicalDistantLightNode({ node }: { node: SceneNode }) {
  const cfg = PHYSICAL_LIGHTS_CONFIG.distantLight
  const lightRef = useRef<THREE.DirectionalLight>(null)
  const targetRef = useRef<THREE.Object3D>(null)
  const [tx, ty, tz] = node.lightTarget ?? cfg.target
  const [lx, ly, lz] = node.transform.position
  const color = node.lightColor ?? cfg.color
  const intensity = node.lightIntensity ?? cfg.intensity

  useLayoutEffect(() => {
    const light = lightRef.current
    const targetObj = targetRef.current
    if (light && targetObj) light.target = targetObj
  })

  return (
    <>
      {/* 照射目标（世界坐标固定，转为相对光源的局部偏移） */}
      <object3D
        ref={targetRef}
        position={[tx - lx, ty - ly, tz - lz]}
        userData={{ ignorePick: true }}
      />
      <directionalLight
        ref={lightRef}
        color={color}
        intensity={intensity}
        castShadow
        shadow-mapSize={cfg.shadowMapSize}
        shadow-bias={cfg.shadowBias}
        shadow-normalBias={cfg.shadowNormalBias}
        shadow-camera-far={cfg.shadowCameraFar}
        shadow-camera-left={-cfg.shadowCameraSize}
        shadow-camera-right={cfg.shadowCameraSize}
        shadow-camera-top={cfg.shadowCameraSize}
        shadow-camera-bottom={-cfg.shadowCameraSize}
      />
      {/* 光源位置指示（可随 Move Gizmo 拖动） */}
      <mesh userData={{ ignorePick: true }}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}
