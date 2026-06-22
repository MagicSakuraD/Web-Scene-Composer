'use client'

import { Suspense } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { useSetAtom } from 'jotai'
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei'
import { MOUSE } from 'three'
import * as THREE from 'three'
import { selectedNodeIdAtom } from '@/lib/scene/atoms'
import { resolvePickedNodeId } from '@/lib/scene/object-registry'
import { SceneRenderer } from './scene-renderer'

/** Blender-style: 左键选择，中键 Orbit 旋转，滚轮缩放 */
export function SceneCanvas() {
  const setSelected = useSetAtom(selectedNodeIdAtom)

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.nativeEvent.button !== 0) return

    const nodeId = resolvePickedNodeId(e.object)
    if (nodeId) {
      setSelected(nodeId)
      e.stopPropagation()
    }
  }

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [6, 5, 8], fov: 50 }}
      className="absolute inset-0"
      onPointerMissed={(e) => {
        if (e.button === 0) setSelected(null)
      }}
      onPointerDown={handlePointerDown}
    >
      <Suspense fallback={null}>
        <SceneRenderer />
      </Suspense>
      <OrbitControls
        makeDefault
        enableDamping={false}
        mouseButtons={{
          LEFT: undefined as unknown as MOUSE,
          MIDDLE: MOUSE.ROTATE,
          RIGHT: undefined as unknown as MOUSE,
        }}
      />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  )
}
