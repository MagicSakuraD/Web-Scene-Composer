'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { useAtomValue } from 'jotai'
import { dataSourceActiveAtom } from '@/lib/playback/atoms'
import { btTimelineStore } from '@/lib/ros/bt-timeline-store'
import { runtimePoseStore } from '@/lib/ros/runtime-pose-store'
import { objectByNodeId } from '@/lib/scene/object-registry'
import { cn } from '@/lib/utils'

const _worldPos = new THREE.Vector3()

/** 3D 视口 HUD：Recovery 等行为树节点运行时提示 */
export function NavRecoveryHud() {
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const groupRef = useRef<THREE.Group>(null)
  const hud = useSyncExternalStore(
    btTimelineStore.subscribeHud.bind(btTimelineStore),
    () => btTimelineStore.getHudSnapshot(),
    () => btTimelineStore.getHudSnapshot(),
  )

  useFrame(() => {
    if (!dataSourceActive || !runtimePoseStore.robotNodeId || !groupRef.current) return
    const obj = objectByNodeId.get(runtimePoseStore.robotNodeId)
    if (!obj) return
    obj.getWorldPosition(_worldPos)
    _worldPos.y += 1.4
    groupRef.current.position.copy(_worldPos)
  })

  if (!dataSourceActive || !hud.message) return null

  return (
    <group ref={groupRef}>
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-sm whitespace-nowrap',
            hud.tone === 'warn' &&
              'border-amber-500/60 bg-amber-500/15 text-amber-800 dark:text-amber-200',
            hud.tone === 'error' &&
              'border-red-500/60 bg-red-500/15 text-red-800 dark:text-red-200',
            hud.tone === 'info' &&
              'border-border bg-background/80 text-foreground',
          )}
        >
          {hud.tone === 'warn' ? '⚠️ ' : hud.tone === 'error' ? '✕ ' : ''}
          {hud.message}
        </div>
      </Html>
    </group>
  )
}
