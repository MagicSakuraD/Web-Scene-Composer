'use client'

import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { laserScanDisplayAtom } from '@/lib/ros/atoms'
import { dataSourceActiveAtom, dataSourceModeAtom } from '@/lib/playback/atoms'
import {
  LASER_SCAN_MAX_POINTS,
  laserScanStore,
} from '@/lib/ros/laser-scan-store'
import { ROS_TO_THREE_Q } from '@/lib/ros/ros-three-coords'
import { tfRuntimeStore, type RosTransform } from '@/lib/ros/tf-runtime-store'
import {
  getPlaybackCloudFrameId,
  getPlaybackGroundLiftY,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'

function useScanGeneration(): number {
  return useSyncExternalStore(
    (cb) => laserScanStore.subscribe(cb),
    () => laserScanStore.generation,
    () => laserScanStore.generation,
  )
}

function identityT(): RosTransform {
  return {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function applyRosPose(group: THREE.Group, T: RosTransform) {
  group.position.set(T.translation.x, T.translation.y, T.translation.z)
  group.quaternion.set(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
}

function LaserScanMesh({
  topic,
  color,
  pointSize,
  dataSourceMode,
}: {
  topic: string
  color: string
  pointSize: number
  dataSourceMode: string
}) {
  const gen = useScanGeneration()
  const liftRef = useRef<THREE.Group>(null)
  const poseRef = useRef<THREE.Group>(null)
  const geoRef = useRef<THREE.BufferGeometry>(null)
  const lastEntryGen = useRef(0)
  const positions = useMemo(() => new Float32Array(LASER_SCAN_MAX_POINTS * 3), [])
  const threeColor = useMemo(() => new THREE.Color(color), [color])

  useLayoutEffect(() => {
    geoRef.current?.setDrawRange(0, 0)
  }, [])

  useFrame(() => {
    const entry = laserScanStore.get(topic)
    const geo = geoRef.current
    const attr = geo?.attributes.position as THREE.BufferAttribute | undefined
    if (entry && geo && attr && entry.generation !== lastEntryGen.current && entry.pointCount > 0) {
      lastEntryGen.current = entry.generation
      const n = entry.pointCount * 3
      ;(attr.array as Float32Array).set(entry.positions.subarray(0, n))
      attr.needsUpdate = true
      geo.setDrawRange(0, entry.pointCount)
      geo.computeBoundingSphere()
    }

    const lift = liftRef.current
    const pose = poseRef.current
    if (!lift || !pose) return

    const frameId = entry?.frameId || 'laser'
    if (dataSourceMode === 'replay') {
      lift.position.set(0, getPlaybackGroundLiftY(), 0)
      const display = lidarPointStore.frameId || getPlaybackCloudFrameId()
      const T =
        frameId && display && frameId !== display
          ? (tfRuntimeStore.lookupTransform(display, frameId) ?? identityT())
          : identityT()
      applyRosPose(pose, T)
      return
    }

    lift.position.set(0, 0, 0)
    const T = tfRuntimeStore.lookupTransform('base_link', frameId)
    applyRosPose(pose, T ?? identityT())
  })

  // silence unused gen for subscription-driven re-render (useFrame reads store)
  void gen

  return (
    <group ref={liftRef} name={`laser-scan:${topic}`}>
      <group quaternion={ROS_TO_THREE_Q}>
        <group ref={poseRef}>
          <points>
            <bufferGeometry ref={geoRef}>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
                usage={THREE.DynamicDrawUsage}
              />
            </bufferGeometry>
            <pointsMaterial
              color={threeColor}
              size={pointSize}
              sizeAttenuation
              toneMapped={false}
              depthWrite={false}
            />
          </points>
        </group>
      </group>
    </group>
  )
}

/** sensor_msgs/LaserScan — 支持多话题同时显示 */
export function LaserScanVisualization() {
  const config = useAtomValue(laserScanDisplayAtom)
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)

  if (!dataSourceActive || config.topics.length === 0) return null

  return (
    <group name="laser-scans">
      {config.topics.map((topic) => (
        <LaserScanMesh
          key={topic}
          topic={topic}
          color={config.color}
          pointSize={config.pointSize}
          dataSourceMode={dataSourceMode}
        />
      ))}
    </group>
  )
}
