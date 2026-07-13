'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { navPathStore, NAV_PATH_MAX_POSES, type NavPathLayerSnapshot } from '@/lib/ros/nav-path-store'

const PLAN_COLOR = '#22d3ee'
const LOCAL_COLOR = '#fbbf24'
const PATH_Y_LIFT = 0.08

type NavPathLayer = {
  poseCount: number
  generation: number
  positions: Float32Array
  getSnapshot: () => NavPathLayerSnapshot
  recomputeDisplay: () => boolean
}

function NavPathLine({
  getLayer,
  color,
  liveTransform = false,
}: {
  getLayer: () => NavPathLayer
  color: string
  liveTransform?: boolean
}) {
  const lastGenerationRef = useRef(-1)

  const line = useMemo(() => {
    const positions = new Float32Array(NAV_PATH_MAX_POSES * 3)
    const geometry = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(positions, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', attr)
    geometry.setDrawRange(0, 0)

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: true,
    })
    const obj = new THREE.Line(geometry, material)
    obj.frustumCulled = false
    obj.visible = false
    obj.position.y = PATH_Y_LIFT
    return obj
  }, [color])

  const pushGeometry = (layer: NavPathLayer) => {
    const geo = line.geometry
    const attr = geo.getAttribute('position') as THREE.BufferAttribute
    if (layer.poseCount < 2) {
      geo.setDrawRange(0, 0)
      line.visible = false
      return
    }

    const n = layer.poseCount * 3
    ;(attr.array as Float32Array).set(layer.positions.subarray(0, n))
    attr.needsUpdate = true
    geo.setDrawRange(0, layer.poseCount)
    geo.computeBoundingSphere()
    line.visible = true
  }

  useFrame(() => {
    const layer = getLayer()

    if (liveTransform) {
      layer.recomputeDisplay()
    }

    if (layer.generation === lastGenerationRef.current) return
    lastGenerationRef.current = layer.generation
    pushGeometry(layer)
  })

  return <primitive object={line} />
}

/** Nav2 全局路径（map）+ /local_plan（通常 odom，与小车同校准） */
export function NavPathLines() {
  const status = useAtomValue(simulateStatusAtom)

  if (status !== 'connected') return null

  return (
    <group name="nav-paths">
      <NavPathLine getLayer={() => navPathStore.globalPlan} color={PLAN_COLOR} />
      <NavPathLine
        getLayer={() => navPathStore.localPlan}
        color={LOCAL_COLOR}
        liveTransform
      />
    </group>
  )
}
