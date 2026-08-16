'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { tfDisplayAtom } from '@/lib/ros/atoms'
import { dataSourceModeAtom } from '@/lib/playback/atoms'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import {
  getSceneGroundLiftY,
  resolveSceneFixedFrame,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

const IDENTITY_T: RosTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
}

const MAX_TF_LINKS = 128
const LINK_FLOATS = MAX_TF_LINKS * 2 * 3

interface AxesEntry {
  group: THREE.Group
  axes: THREE.AxesHelper
}

function lookupOrIdentity(fixedFrame: string, frame: string): RosTransform | null {
  if (fixedFrame === frame) return IDENTITY_T
  return tfRuntimeStore.lookupTransform(fixedFrame, frame)
}

/**
 * Foxglove-style TF axes + parent links.
 * Frame set changes rarely; poses mutate in useFrame (no remount on /tf).
 */
export function TfAxesVisualization() {
  const config = useAtomValue(tfDisplayAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const liftRef = useRef<THREE.Group>(null)
  const rosRef = useRef<THREE.Group>(null)
  const linksRef = useRef<THREE.LineSegments>(null)
  const poolRef = useRef<Map<string, AxesEntry>>(new Map())
  const configRef = useRef(config)
  const modeRef = useRef(dataSourceMode)
  configRef.current = config
  modeRef.current = dataSourceMode

  const linkPositions = useMemo(() => new Float32Array(LINK_FLOATS), [])
  const linkMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#e8c84a',
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      linkMaterial.dispose()
      const ros = rosRef.current
      for (const entry of poolRef.current.values()) {
        ros?.remove(entry.group)
        entry.axes.geometry.dispose()
        const mat = entry.axes.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat.dispose()
      }
      poolRef.current.clear()
    }
  }, [linkMaterial])

  useFrame(() => {
    const cfg = configRef.current
    const lift = liftRef.current
    const ros = rosRef.current
    const links = linksRef.current
    if (!lift || !ros || !cfg.enabled || !cfg.showAxes) return

    lift.position.set(0, getSceneGroundLiftY(modeRef.current), 0)

    const fixedFrame = resolveSceneFixedFrame({
      configured: cfg.fixedFrame,
      dataSourceMode: modeRef.current,
      lidarFrameId: lidarPointStore.frameId,
    })
    const frames = tfRuntimeStore.getFrameIds()
    const live = new Set<string>()
    let linkCount = 0

    for (const frame of frames) {
      if (cfg.hiddenFrames[frame] === true) continue
      const T = lookupOrIdentity(fixedFrame, frame)
      if (!T) continue
      live.add(frame)

      let entry = poolRef.current.get(frame)
      if (!entry) {
        const group = new THREE.Group()
        group.userData.ignorePick = true
        const axes = new THREE.AxesHelper(1)
        axes.userData.ignorePick = true
        group.add(axes)
        ros.add(group)
        entry = { group, axes }
        poolRef.current.set(frame, entry)
      }

      entry.group.visible = true
      entry.group.position.set(T.translation.x, T.translation.y, T.translation.z)
      entry.group.quaternion.set(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
      const len = cfg.axisLength * (cfg.selectedFrame === frame ? 1.35 : 1)
      entry.group.scale.setScalar(len)

      if (cfg.showLinks && linkCount < MAX_TF_LINKS) {
        const parentEdge = tfRuntimeStore.getEdge(frame)
        if (parentEdge) {
          const Tp = lookupOrIdentity(fixedFrame, parentEdge.parentFrame)
          if (Tp) {
            const o = linkCount * 6
            linkPositions[o] = Tp.translation.x
            linkPositions[o + 1] = Tp.translation.y
            linkPositions[o + 2] = Tp.translation.z
            linkPositions[o + 3] = T.translation.x
            linkPositions[o + 4] = T.translation.y
            linkPositions[o + 5] = T.translation.z
            linkCount += 1
          }
        }
      }
    }

    for (const [frame, entry] of poolRef.current) {
      if (live.has(frame)) continue
      ros.remove(entry.group)
      entry.axes.geometry.dispose()
      const mat = entry.axes.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
      poolRef.current.delete(frame)
    }

    if (links) {
      const attr = links.geometry.attributes.position as THREE.BufferAttribute
      attr.needsUpdate = true
      links.geometry.setDrawRange(0, linkCount * 2)
      links.visible = cfg.showLinks && linkCount > 0
    }
  })

  if (!config.enabled || !config.showAxes) return null

  return (
    <group ref={liftRef} name="tf-axes" userData={{ ignorePick: true }}>
      <group ref={rosRef} quaternion={ROS_TO_THREE_Q} userData={{ ignorePick: true }}>
        <lineSegments ref={linksRef} frustumCulled={false} userData={{ ignorePick: true }}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[linkPositions, 3]}
              usage={THREE.DynamicDrawUsage}
            />
          </bufferGeometry>
          <primitive object={linkMaterial} attach="material" />
        </lineSegments>
      </group>
    </group>
  )
}
