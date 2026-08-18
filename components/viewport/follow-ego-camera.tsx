'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { dataSourceActiveAtom } from '@/lib/playback/atoms'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { objectByNodeId } from '@/lib/scene/object-registry'

const _ego = new THREE.Vector3()
const _delta = new THREE.Vector3()

/**
 * Foxglove follow-position：轨道中心锁在自车上，保留当前相机相对偏移。
 * Fixed Frame 仍是 map/odom（地图不动）；这里只动相机，不改场景坐标系。
 */
export function FollowEgoCamera() {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls as OrbitControlsImpl | null)
  const lastEgo = useRef(new THREE.Vector3())
  const lockedRef = useRef(false)
  const boundIdRef = useRef<string | null>(null)

  useFrame(() => {
    if (!dataSourceActive || !controls || !runtimePoseStore.robotNodeId) {
      lockedRef.current = false
      boundIdRef.current = null
      return
    }

    const obj = objectByNodeId.get(runtimePoseStore.robotNodeId)
    if (!obj) return

    obj.getWorldPosition(_ego)

    const id = runtimePoseStore.robotNodeId
    if (!lockedRef.current || boundIdRef.current !== id) {
      _delta.copy(camera.position).sub(controls.target)
      controls.target.copy(_ego)
      camera.position.copy(_ego).add(_delta)
      lastEgo.current.copy(_ego)
      boundIdRef.current = id
      lockedRef.current = true
      controls.update()
      return
    }

    _delta.copy(_ego).sub(lastEgo.current)
    if (_delta.lengthSq() < 1e-12) return

    camera.position.add(_delta)
    controls.target.add(_delta)
    lastEgo.current.copy(_ego)
    controls.update()
  }, 1)

  return null
}
