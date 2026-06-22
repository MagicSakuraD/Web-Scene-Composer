'use client'

import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { gamepadConnectedAtom, gamepadLabelAtom } from '@/lib/ros/atoms'
import { findActiveGamepad, isGamepadApiSupported } from '@/lib/gamepad/find-gamepad'

/** 独立于 Simulate 的手柄检测 — 浏览器需用户手势 + 按手柄任意键唤醒 */
export function useGamepadDetection(enabled: boolean) {
  const setConnected = useSetAtom(gamepadConnectedAtom)
  const setLabel = useSetAtom(gamepadLabelAtom)

  useEffect(() => {
    if (!enabled) {
      setConnected(false)
      setLabel(null)
      return
    }

    if (!isGamepadApiSupported()) {
      setConnected(false)
      setLabel('浏览器不支持 Gamepad API')
      return
    }

    let raf = 0

    const sync = () => {
      const gp = findActiveGamepad()
      if (gp) {
        setConnected(true)
        setLabel(gp.id || `Gamepad ${gp.index}`)
      } else {
        setConnected(false)
        setLabel(null)
      }
      raf = requestAnimationFrame(sync)
    }

    const onGamepadEvent = (e: GamepadEvent) => {
      const gp = e.gamepad
      if (gp?.connected) {
        setConnected(true)
        setLabel(gp.id || `Gamepad ${gp.index}`)
      }
    }

    window.addEventListener('gamepadconnected', onGamepadEvent)
    window.addEventListener('gamepaddisconnected', () => {
      const gp = findActiveGamepad()
      if (gp) {
        setConnected(true)
        setLabel(gp.id || `Gamepad ${gp.index}`)
      } else {
        setConnected(false)
        setLabel(null)
      }
    })

    raf = requestAnimationFrame(sync)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('gamepadconnected', onGamepadEvent)
      setConnected(false)
      setLabel(null)
    }
  }, [enabled, setConnected, setLabel])
}
