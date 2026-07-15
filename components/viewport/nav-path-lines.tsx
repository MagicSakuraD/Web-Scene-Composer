'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import { navPathStore, NAV_PATH_MAX_POSES, type NavPathLayerSnapshot } from '@/lib/ros/nav-path-store'

const PLAN_COLOR = '#0ea5e9'
const LOCAL_COLOR = '#10b981'
const PATH_Y_LIFT = 0.04
/** 局部路径半宽（米） */
const LOCAL_PLAN_HALF_WIDTH = 0.14
/**
 * 相邻点最小间距（米）。/local_plan 在急弯处常挤很密的点；
 * 间距远小于半宽时，连续 ribbon 会左右边自交成「翻折三角」。
 */
const RIBBON_MIN_SEGMENT = 0.06

type NavPathLayer = {
  poseCount: number
  generation: number
  positions: Float32Array
  getSnapshot: () => NavPathLayerSnapshot
  recomputeDisplay: () => boolean
}

const _fwd = new THREE.Vector3()
const _left = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/**
 * 合并过近的采样点（XZ），始终保留首尾。
 * 返回压缩后的点数。
 */
function compactPathPoints(
  src: Float32Array,
  poseCount: number,
  minDist: number,
  out: Float32Array,
): number {
  if (poseCount < 2) return 0

  const minDistSq = minDist * minDist
  let n = 0

  out[0] = src[0]
  out[1] = src[1]
  out[2] = src[2]
  n = 1

  for (let i = 1; i < poseCount; i++) {
    const i3 = i * 3
    const p3 = (n - 1) * 3
    const dx = src[i3] - out[p3]
    const dz = src[i3 + 2] - out[p3 + 2]
    const isLast = i === poseCount - 1
    if (dx * dx + dz * dz >= minDistSq || isLast) {
      // 末点若仍过近，覆盖上一点，避免尾巴再拧一下
      if (isLast && dx * dx + dz * dz < minDistSq && n > 1) {
        out[p3] = src[i3]
        out[p3 + 1] = src[i3 + 1]
        out[p3 + 2] = src[i3 + 2]
      } else {
        const o3 = n * 3
        out[o3] = src[i3]
        out[o3 + 1] = src[i3 + 1]
        out[o3 + 2] = src[i3 + 2]
        n++
      }
    }
  }

  return n >= 2 ? n : 0
}

/**
 * 路面 ribbon：先抽稀，再「逐段独立四边形」。
 * 不用共享顶点的连续 strip——急弯处 miter 很容易自交（图中绿条先端翻折）。
 * 半透明时段与段轻微重叠，观感仍像连续路面。
 */
function fillRoadRibbon(
  pathPositions: Float32Array,
  poseCount: number,
  halfWidth: number,
  compactOut: Float32Array,
  outPositions: Float32Array,
  outIndices: Uint32Array,
): { vertexCount: number; indexCount: number } {
  const minDist = Math.max(RIBBON_MIN_SEGMENT, halfWidth * 0.35)
  const n = compactPathPoints(pathPositions, poseCount, minDist, compactOut)
  if (n < 2) return { vertexCount: 0, indexCount: 0 }

  let v = 0
  let idx = 0

  for (let i = 0; i < n - 1; i++) {
    const a3 = i * 3
    const b3 = (i + 1) * 3
    const x0 = compactOut[a3]
    const y0 = compactOut[a3 + 1] + PATH_Y_LIFT
    const z0 = compactOut[a3 + 2]
    const x1 = compactOut[b3]
    const y1 = compactOut[b3 + 1] + PATH_Y_LIFT
    const z1 = compactOut[b3 + 2]

    _fwd.set(x1 - x0, 0, z1 - z0)
    if (_fwd.lengthSq() < 1e-12) continue
    _fwd.normalize()
    _left.crossVectors(_up, _fwd).normalize()

    const lx = _left.x * halfWidth
    const lz = _left.z * halfWidth
    const base = v / 3

    // L0, R0, L1, R1
    outPositions[v++] = x0 + lx
    outPositions[v++] = y0
    outPositions[v++] = z0 + lz
    outPositions[v++] = x0 - lx
    outPositions[v++] = y0
    outPositions[v++] = z0 - lz
    outPositions[v++] = x1 + lx
    outPositions[v++] = y1
    outPositions[v++] = z1 + lz
    outPositions[v++] = x1 - lx
    outPositions[v++] = y1
    outPositions[v++] = z1 - lz

    outIndices[idx++] = base
    outIndices[idx++] = base + 1
    outIndices[idx++] = base + 2
    outIndices[idx++] = base + 1
    outIndices[idx++] = base + 3
    outIndices[idx++] = base + 2
  }

  return { vertexCount: v / 3, indexCount: idx }
}

/** 全局路径：1px Line（WebGPU 屏幕像素线） */
function NavPathPixelLine({
  getLayer,
  color,
}: {
  getLayer: () => NavPathLayer
  color: string
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
      toneMapped: false,
    })
    const obj = new THREE.Line(geometry, material)
    obj.frustumCulled = false
    obj.visible = false
    obj.position.y = PATH_Y_LIFT
    obj.renderOrder = 2
    obj.userData.ignorePick = true
    return obj
  }, [color])

  useFrame(() => {
    const layer = getLayer()
    if (layer.generation === lastGenerationRef.current) return
    lastGenerationRef.current = layer.generation

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
  })

  return <primitive object={line} />
}

/** 局部路径：路面 ribbon */
function NavPathRibbon({
  getLayer,
  color,
  halfWidth,
  liveTransform = false,
  opacity = 0.8,
}: {
  getLayer: () => NavPathLayer
  color: string
  halfWidth: number
  liveTransform?: boolean
  opacity?: number
}) {
  const lastGenerationRef = useRef(-1)
  const ribbonScratch = useMemo(
    () => ({
      compact: new Float32Array(NAV_PATH_MAX_POSES * 3),
      // 逐段四边形：每段 4 顶点
      positions: new Float32Array((NAV_PATH_MAX_POSES - 1) * 4 * 3),
      indices: new Uint32Array((NAV_PATH_MAX_POSES - 1) * 6),
    }),
    [],
  )

  const mesh = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    const posAttr = new THREE.BufferAttribute(
      new Float32Array((NAV_PATH_MAX_POSES - 1) * 4 * 3),
      3,
    )
    posAttr.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('position', posAttr)
    geometry.setIndex(new THREE.BufferAttribute(new Uint32Array((NAV_PATH_MAX_POSES - 1) * 6), 1))
    ;(geometry.getIndex() as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage)
    geometry.setDrawRange(0, 0)

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
    const obj = new THREE.Mesh(geometry, material)
    obj.frustumCulled = false
    obj.visible = false
    obj.renderOrder = 2
    obj.userData.ignorePick = true
    return obj
  }, [color, opacity])

  useFrame(() => {
    const layer = getLayer()

    if (liveTransform) {
      layer.recomputeDisplay()
    }

    if (layer.generation === lastGenerationRef.current) return
    lastGenerationRef.current = layer.generation

    const geo = mesh.geometry
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute
    const indexAttr = geo.getIndex() as THREE.BufferAttribute

    if (layer.poseCount < 2) {
      geo.setDrawRange(0, 0)
      mesh.visible = false
      return
    }

    const { vertexCount, indexCount } = fillRoadRibbon(
      layer.positions,
      layer.poseCount,
      halfWidth,
      ribbonScratch.compact,
      ribbonScratch.positions,
      ribbonScratch.indices,
    )

    if (indexCount < 1) {
      geo.setDrawRange(0, 0)
      mesh.visible = false
      return
    }

    ;(posAttr.array as Float32Array).set(ribbonScratch.positions.subarray(0, vertexCount * 3))
    posAttr.needsUpdate = true
    ;(indexAttr.array as Uint32Array).set(ribbonScratch.indices.subarray(0, indexCount))
    indexAttr.needsUpdate = true

    geo.setDrawRange(0, indexCount)
    geo.computeBoundingSphere()
    mesh.visible = true
  })

  return <primitive object={mesh} />
}

/** 全局 /plan：1px 线；局部 /local_plan：0.14m 半宽路面 */
export function NavPathLines() {
  const status = useAtomValue(simulateStatusAtom)

  if (status !== 'connected') return null

  return (
    <group name="nav-paths">
      <NavPathPixelLine getLayer={() => navPathStore.globalPlan} color={PLAN_COLOR} />
      <NavPathRibbon
        getLayer={() => navPathStore.localPlan}
        color={LOCAL_COLOR}
        halfWidth={LOCAL_PLAN_HALF_WIDTH}
        liveTransform
        opacity={0.8}
      />
    </group>
  )
}
