'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
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

function useTfGeneration(): number {
  return useSyncExternalStore(
    (cb) => tfRuntimeStore.subscribe(cb),
    () => tfRuntimeStore.generation,
    () => tfRuntimeStore.generation,
  )
}

function useLidarFrameId(): string {
  return useSyncExternalStore(
    (cb) => lidarPointStore.subscribe(cb),
    () => lidarPointStore.getSnapshot().frameId,
    () => lidarPointStore.getSnapshot().frameId,
  )
}

function identityT(): RosTransform {
  return {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function ParentLink({ positions }: { positions: Float32Array }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#e8c84a" toneMapped={false} transparent opacity={0.85} />
    </lineSegments>
  )
}

function FrameAxes({
  frame,
  fixedFrame,
  axisLength,
  showLinks,
  selected,
}: {
  frame: string
  fixedFrame: string
  axisLength: number
  showLinks: boolean
  selected: boolean
}) {
  const T =
    fixedFrame === frame
      ? identityT()
      : (tfRuntimeStore.lookupTransform(fixedFrame, frame) ?? null)
  if (!T) return null

  const parentEdge = tfRuntimeStore.getEdge(frame)
  let parentLine: Float32Array | null = null
  if (showLinks && parentEdge) {
    const Tp =
      fixedFrame === parentEdge.parentFrame
        ? identityT()
        : tfRuntimeStore.lookupTransform(fixedFrame, parentEdge.parentFrame)
    if (Tp) {
      parentLine = new Float32Array([
        Tp.translation.x,
        Tp.translation.y,
        Tp.translation.z,
        T.translation.x,
        T.translation.y,
        T.translation.z,
      ])
    }
  }

  const quat = new THREE.Quaternion(
    T.rotation.x,
    T.rotation.y,
    T.rotation.z,
    T.rotation.w,
  )

  return (
    <group>
      <group
        position={[T.translation.x, T.translation.y, T.translation.z]}
        quaternion={quat}
      >
        <axesHelper args={[axisLength * (selected ? 1.35 : 1)]} />
      </group>
      {parentLine ? <ParentLink positions={parentLine} /> : null}
    </group>
  )
}

/** Foxglove-style TF axes (RGB) + yellow parent links in the display / fixed frame */
export function TfAxesVisualization() {
  const config = useAtomValue(tfDisplayAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const tfGen = useTfGeneration()
  const lidarFrameId = useLidarFrameId()

  const fixedFrame = useMemo(
    () =>
      resolveSceneFixedFrame({
        configured: config.fixedFrame,
        dataSourceMode,
        lidarFrameId,
      }),
    [config.fixedFrame, dataSourceMode, lidarFrameId, tfGen],
  )

  const frames = useMemo(() => tfRuntimeStore.getFrameIds(), [tfGen])
  const groundLiftY = useMemo(
    () => getSceneGroundLiftY(dataSourceMode),
    [tfGen, lidarFrameId, dataSourceMode],
  )

  if (!config.enabled || !config.showAxes || frames.length === 0) return null

  return (
    <group name="tf-axes" position={[0, groundLiftY, 0]}>
      <group quaternion={ROS_TO_THREE_Q}>
        {frames.map((frame) => {
          if (config.hiddenFrames[frame] === true) return null
          return (
            <FrameAxes
              key={`${frame}-${tfGen}`}
              frame={frame}
              fixedFrame={fixedFrame}
              axisLength={config.axisLength}
              showLinks={config.showLinks}
              selected={config.selectedFrame === frame}
            />
          )
        })}
      </group>
    </group>
  )
}
