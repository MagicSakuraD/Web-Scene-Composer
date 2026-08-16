'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import * as THREE from 'three'
import { laserScanDisplayAtom, tfDisplayAtom } from '@/lib/ros/atoms'
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
  resolveSceneFixedFrame,
} from '@/lib/ros/playback-display-frame'
import { lidarPointStore } from '@/lib/ros/lidar-point-store'
import { disableSensorRaycast } from '@/lib/viewport/viewport-layers'

const IDENTITY_T: RosTransform = {
  translation: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
}

const _solid = new THREE.Color()

function applyRosPose(group: THREE.Group, T: RosTransform) {
  group.position.set(T.translation.x, T.translation.y, T.translation.z)
  group.quaternion.set(T.rotation.x, T.rotation.y, T.rotation.z, T.rotation.w)
}

/** Same rainbow as 3D lidar TSL: t=0 near red → cyan/magenta far. */
function writeScanColors(
  positions: Float32Array,
  colors: Float32Array,
  count: number,
  minD: number,
  maxD: number,
  mode: 'distance' | 'solid',
  solidHex: string,
) {
  const range = Math.max(maxD - minD, 0.05)
  const tau = Math.PI * 2
  if (mode === 'solid') {
    _solid.set(solidHex)
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      colors[i3] = _solid.r
      colors[i3 + 1] = _solid.g
      colors[i3 + 2] = _solid.b
    }
    return
  }
  for (let i = 0; i < count; i++) {
    const i3 = i * 3
    const x = positions[i3]
    const y = positions[i3 + 1]
    const d = Math.sqrt(x * x + y * y)
    const t = Math.min(1, Math.max(0, (d - minD) / range))
    colors[i3] = 0.5 + 0.5 * Math.cos(tau * t)
    colors[i3 + 1] = 0.5 + 0.5 * Math.cos(tau * (t + 0.33))
    colors[i3 + 2] = 0.5 + 0.5 * Math.cos(tau * (t + 0.67))
  }
}

function LaserScanMesh({
  topic,
  dataSourceMode,
}: {
  topic: string
  dataSourceMode: string
}) {
  const config = useAtomValue(laserScanDisplayAtom)
  const tfConfig = useAtomValue(tfDisplayAtom)
  const liftRef = useRef<THREE.Group>(null)
  const poseRef = useRef<THREE.Group>(null)
  const geoRef = useRef<THREE.BufferGeometry>(null)
  const pointsRef = useRef<THREE.Points>(null)
  const materialRef = useRef<THREE.PointsMaterial>(null)
  const lastEntryGen = useRef(0)
  const lastColorKey = useRef('')
  const lastTfGen = useRef(-1)
  const lastDisplayKey = useRef('')
  const positions = useMemo(() => new Float32Array(LASER_SCAN_MAX_POINTS * 3), [])
  const colors = useMemo(() => new Float32Array(LASER_SCAN_MAX_POINTS * 3), [])
  const configRef = useRef(config)
  const tfConfigRef = useRef(tfConfig)
  const modeRef = useRef(dataSourceMode)
  configRef.current = config
  tfConfigRef.current = tfConfig
  modeRef.current = dataSourceMode

  useLayoutEffect(() => {
    geoRef.current?.setDrawRange(0, 0)
    if (pointsRef.current) disableSensorRaycast(pointsRef.current)
  }, [])

  useFrame(() => {
    const cfg = configRef.current
    const mat = materialRef.current
    if (mat) {
      mat.size = cfg.pointSize
      mat.opacity = cfg.opacity
    }

    const entry = laserScanStore.get(topic)
    const geo = geoRef.current
    const posAttr = geo?.attributes.position as THREE.BufferAttribute | undefined
    const colorAttr = geo?.attributes.color as THREE.BufferAttribute | undefined
    const colorKey = `${cfg.colorMode}|${cfg.color}|${entry?.generation ?? 0}`
    if (
      entry &&
      geo &&
      posAttr &&
      colorAttr &&
      entry.pointCount > 0 &&
      (entry.generation !== lastEntryGen.current || colorKey !== lastColorKey.current)
    ) {
      lastEntryGen.current = entry.generation
      lastColorKey.current = colorKey
      const n = entry.pointCount * 3
      const pos = posAttr.array as Float32Array
      pos.set(entry.positions.subarray(0, n))
      posAttr.needsUpdate = true
      writeScanColors(
        pos,
        colorAttr.array as Float32Array,
        entry.pointCount,
        entry.distMin,
        entry.distMax,
        cfg.colorMode === 'solid' ? 'solid' : 'distance',
        cfg.color,
      )
      colorAttr.needsUpdate = true
      geo.setDrawRange(0, entry.pointCount)
    }

    const lift = liftRef.current
    const pose = poseRef.current
    if (!lift || !pose) return

    const mode = modeRef.current
    const frameId = entry?.frameId || 'laser'
    const displayFrame = resolveSceneFixedFrame({
      configured: tfConfigRef.current.fixedFrame,
      dataSourceMode: mode,
      lidarFrameId: lidarPointStore.frameId,
    })
    const tfGen = tfRuntimeStore.generation
    const displayKey = `${mode}|${displayFrame}|${frameId}`
    if (tfGen === lastTfGen.current && displayKey === lastDisplayKey.current) return
    lastTfGen.current = tfGen
    lastDisplayKey.current = displayKey

    if (mode === 'replay') {
      lift.position.set(0, getPlaybackGroundLiftY(), 0)
      const display = lidarPointStore.frameId || getPlaybackCloudFrameId()
      const T =
        frameId && display && frameId !== display
          ? (tfRuntimeStore.lookupTransform(display, frameId) ?? IDENTITY_T)
          : IDENTITY_T
      applyRosPose(pose, T)
      return
    }

    lift.position.set(0, 0, 0)
    const T =
      frameId && displayFrame && frameId !== displayFrame
        ? (tfRuntimeStore.lookupTransform(displayFrame, frameId) ?? IDENTITY_T)
        : IDENTITY_T
    applyRosPose(pose, T)
  })

  return (
    <group ref={liftRef} name={`laser-scan:${topic}`}>
      <group quaternion={ROS_TO_THREE_Q}>
        <group ref={poseRef}>
          <points ref={pointsRef}>
            <bufferGeometry ref={geoRef}>
              <bufferAttribute
                attach="attributes-position"
                args={[positions, 3]}
                usage={THREE.DynamicDrawUsage}
              />
              <bufferAttribute
                attach="attributes-color"
                args={[colors, 3]}
                usage={THREE.DynamicDrawUsage}
              />
            </bufferGeometry>
            <pointsMaterial
              ref={materialRef}
              vertexColors
              size={config.pointSize}
              sizeAttenuation
              transparent
              opacity={config.opacity}
              toneMapped={false}
              depthWrite={false}
            />
          </points>
        </group>
      </group>
    </group>
  )
}

/** sensor_msgs/LaserScan — 几何复用；TF / 点数据在 useFrame 读 store */
export function LaserScanVisualization() {
  const config = useAtomValue(laserScanDisplayAtom)
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)

  if (!dataSourceActive || config.topics.length === 0) return null

  return (
    <group name="laser-scans">
      {config.topics.map((topic) => (
        <LaserScanMesh key={topic} topic={topic} dataSourceMode={dataSourceMode} />
      ))}
    </group>
  )
}
