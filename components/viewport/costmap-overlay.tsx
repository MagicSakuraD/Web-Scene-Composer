'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { simulateStatusAtom } from '@/lib/ros/atoms'
import {
  localCostmapStore,
  globalCostmapStore,
  type CostmapKind,
  type CostmapStore,
} from '@/lib/ros/costmap-store'
import { rosPathPointToSceneThree } from '@/lib/ros/nav-path-transform'

// 两层错开一点点高度，避免 z-fighting（全局在下、局部在上）
const Y_LIFT_BY_KIND: Record<CostmapKind, number> = {
  global: 0.015,
  local: 0.03,
}
const RENDER_ORDER_BY_KIND: Record<CostmapKind, number> = {
  global: 2,
  local: 3,
}
const _originPos = new THREE.Vector3()
const _originQuat = new THREE.Quaternion()
const _yawEuler = new THREE.Euler(0, 0, 0, 'YXZ')

/** Nav2 cost → RGBA（unknown 透明）；global 用冷色（蓝→紫）区分 local（绿→红） */
function costToRgba(cost: number, out: Uint8Array, i: number, kind: CostmapKind) {
  if (cost < 0) {
    out[i] = 0
    out[i + 1] = 0
    out[i + 2] = 0
    out[i + 3] = 0
    return
  }

  if (kind === 'global') {
    if (cost === 0) {
      out[i] = 129
      out[i + 1] = 140
      out[i + 2] = 248
      out[i + 3] = 24
      return
    }
    if (cost >= 100) {
      out[i] = 168
      out[i + 1] = 85
      out[i + 2] = 247
      out[i + 3] = 190
      return
    }
    // 1–99: teal → blue → purple
    const t = cost / 100
    out[i] = Math.round(45 + t * (168 - 45))
    out[i + 1] = Math.round(212 - t * (212 - 85))
    out[i + 2] = Math.round(191 + t * (247 - 191))
    out[i + 3] = Math.round(36 + t * 130)
    return
  }

  if (cost === 0) {
    out[i] = 56
    out[i + 1] = 189
    out[i + 2] = 248
    out[i + 3] = 28
    return
  }
  if (cost >= 100) {
    out[i] = 239
    out[i + 1] = 68
    out[i + 2] = 68
    out[i + 3] = 200
    return
  }
  // 1–99: green → yellow → red
  const t = cost / 100
  if (t < 0.5) {
    const u = t / 0.5
    out[i] = Math.round(34 + u * (250 - 34))
    out[i + 1] = Math.round(197 + u * (204 - 197))
    out[i + 2] = Math.round(94 * (1 - u))
  } else {
    const u = (t - 0.5) / 0.5
    out[i] = Math.round(250 + u * (239 - 250))
    out[i + 1] = Math.round(204 * (1 - u))
    out[i + 2] = Math.round(68 * u)
  }
  out[i + 3] = Math.round(40 + t * 140)
}

function fillRgbaFromOccupancy(
  data: Int8Array,
  width: number,
  height: number,
  rgba: Uint8Array,
  kind: CostmapKind,
) {
  // ROS row-major: index = y * width + x；纹理 v 向上时用 flipY=false 保持 y=0 在原点边
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = y * width + x
      const dst = src * 4
      costToRgba(data[src] ?? -1, rgba, dst, kind)
    }
  }
}

function updateCostmapWorldPose(
  mesh: THREE.Object3D,
  frameId: string,
  originPos: { x: number; y: number; z: number },
  originOri: { x: number; y: number; z: number; w: number },
  yLift: number,
) {
  rosPathPointToSceneThree(originPos.x, originPos.y, originPos.z, frameId, _originPos)

  // costmap 通常水平；取 ROS yaw → Three Y
  const qRos = new THREE.Quaternion(originOri.x, originOri.y, originOri.z, originOri.w)
  const yaw = new THREE.Euler().setFromQuaternion(qRos, 'ZYX').z
  _yawEuler.set(0, yaw, 0)
  _originQuat.setFromEuler(_yawEuler)

  mesh.position.copy(_originPos)
  mesh.position.y += yLift
  mesh.quaternion.copy(_originQuat)
}

function CostmapLayer({ store }: { store: CostmapStore }) {
  const status = useAtomValue(simulateStatusAtom)
  const meshRef = useRef<THREE.Mesh>(null)
  const texRef = useRef<THREE.DataTexture | null>(null)
  const rgbaRef = useRef<Uint8Array | null>(null)
  const lastGenRef = useRef(-1)
  const lastSizeRef = useRef({ w: 0, h: 0 })
  const kind = store.kind
  const yLift = Y_LIFT_BY_KIND[kind]

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 1,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      texRef.current?.dispose()
      texRef.current = null
    }
  }, [material])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const snap = store.getSnapshot()
    if (status !== 'connected' || !snap.visible || !snap.hasData || !store.data) {
      mesh.visible = false
      return
    }

    const { width, height, resolution, frameId, generation } = snap
    if (width < 1 || height < 1 || resolution <= 0) {
      mesh.visible = false
      return
    }

    const mapW = width * resolution
    const mapH = height * resolution
    const cells = width * height

    if (lastSizeRef.current.w !== width || lastSizeRef.current.h !== height) {
      lastSizeRef.current = { w: width, h: height }
      texRef.current?.dispose()
      rgbaRef.current = new Uint8Array(cells * 4)
      const tex = new THREE.DataTexture(rgbaRef.current, width, height, THREE.RGBAFormat)
      tex.magFilter = THREE.NearestFilter
      tex.minFilter = THREE.NearestFilter
      tex.flipY = false
      tex.needsUpdate = true
      texRef.current = tex
      material.map = tex
      material.needsUpdate = true

      const geo = new THREE.PlaneGeometry(mapW, mapH)
      geo.rotateX(-Math.PI / 2)
      // cell (0,0) 落在原点；+X / −Z 对应 map +x / +y
      geo.translate(mapW / 2, 0, -mapH / 2)
      mesh.geometry.dispose()
      mesh.geometry = geo
      lastGenRef.current = -1
    }

    if (generation !== lastGenRef.current && rgbaRef.current && texRef.current) {
      fillRgbaFromOccupancy(store.data, width, height, rgbaRef.current, kind)
      texRef.current.needsUpdate = true
      lastGenRef.current = generation
    }

    updateCostmapWorldPose(mesh, frameId, store.origin.position, store.origin.orientation, yLift)
    mesh.visible = true
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      visible={false}
      frustumCulled={false}
      renderOrder={RENDER_ORDER_BY_KIND[kind]}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

export function CostmapOverlay() {
  return (
    <>
      <CostmapLayer store={globalCostmapStore} />
      <CostmapLayer store={localCostmapStore} />
    </>
  )
}
