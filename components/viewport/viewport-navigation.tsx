'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtomValue } from 'jotai'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { selectedNodeIdAtom } from '@/lib/scene/atoms'
import { appModeAtom } from '@/lib/playback/atoms'
import { objectByNodeId } from '@/lib/scene/object-registry'
import {
  applyFlyDelta,
  computeFlyDelta,
  FLY_KEY_BINDINGS,
  frameObject,
  isTypingTarget,
} from '@/lib/viewport/camera-navigation'

/**
 * F — 聚焦选中物体
 * Compose：按住 RMB + WASD / 方向键 / QE / PageUp·Down — 飞行导航
 * Playback：右键交给 OrbitControls 平移，不启用飞行
 */
export function ViewportNavigation() {
  const { camera, gl } = useThree()
  const controls = useThree((s) => s.controls as OrbitControlsImpl | null)
  const selectedId = useAtomValue(selectedNodeIdAtom)
  const appMode = useAtomValue(appModeAtom)
  const flyEnabled = appMode === 'compose'

  const rmbDown = useRef(false)
  const flyKeys = useRef(new Set<string>())

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      if (!flyEnabled) return
      if (e.button === 2) {
        rmbDown.current = true
        e.preventDefault()
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2) rmbDown.current = false
    }

    const onContextMenu = (e: Event) => e.preventDefault()

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      if (e.code in FLY_KEY_BINDINGS) {
        flyKeys.current.add(e.code)
        if (flyEnabled && rmbDown.current) e.preventDefault()
        return
      }

      if (e.code === 'KeyF' && !e.repeat) {
        if (!selectedId) return
        const obj = objectByNodeId.get(selectedId)
        if (!obj || !controls) return
        e.preventDefault()
        frameObject(obj, camera, controls)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      flyKeys.current.delete(e.code)
    }

    const onBlur = () => {
      rmbDown.current = false
      flyKeys.current.clear()
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [gl, camera, controls, selectedId, flyEnabled])

  useFrame((_, delta) => {
    if (!flyEnabled || !rmbDown.current || !controls || flyKeys.current.size === 0) return

    const move = computeFlyDelta(flyKeys.current, camera, delta)
    if (move) applyFlyDelta(move, camera, controls)
  })

  return null
}
