'use client'

import { useEffect, useRef } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  simulateStatusAtom,
  cmdVelTuningAtom,
  lastCmdVelAtom,
  cmdVelAdvertisedAtom,
} from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { findActiveGamepad } from '@/lib/gamepad/find-gamepad'

/** Forza-style mapping: RT 加速, LT 刹车/倒车, 左摇杆 X 转向 */
function readForzaStyleInput(
  gp: Gamepad,
  tuning: { maxLinear: number; maxAngular: number; deadzone: number },
) {
  const dz = tuning.deadzone
  const applyDeadzone = (v: number) => (Math.abs(v) < dz ? 0 : v)

  const rt = gp.buttons[7]?.value ?? 0
  const lt = gp.buttons[6]?.value ?? 0
  const steer = applyDeadzone(-(gp.axes[0] ?? 0))

  const linearX = (rt - lt) * tuning.maxLinear
  const angularZ = steer * tuning.maxAngular

  return { linearX, angularZ }
}

export function useGamepadCmdVel(enabled: boolean) {
  const status = useAtomValue(simulateStatusAtom)
  const cmdVelAdvertised = useAtomValue(cmdVelAdvertisedAtom)
  const tuning = useAtomValue(cmdVelTuningAtom)
  const [, setLastCmd] = useAtom(lastCmdVelAtom)
  const rafRef = useRef<number>(0)
  const lastPubRef = useRef(0)

  useEffect(() => {
    const canPublish = enabled && status === 'connected' && cmdVelAdvertised
    if (!canPublish) return

    const intervalMs = 1000 / tuning.publishHz

    const tick = () => {
      const gp = findActiveGamepad()

      if (gp) {
        const now = performance.now()
        if (now - lastPubRef.current >= intervalMs) {
          const { linearX, angularZ } = readForzaStyleInput(gp, tuning)
          setLastCmd({ linearX, angularZ })
          foxgloveManager.publishCmdVel({
            linear: { x: linearX, y: 0, z: 0 },
            angular: { x: 0, y: 0, z: angularZ },
          })
          lastPubRef.current = now
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [enabled, status, cmdVelAdvertised, tuning, setLastCmd])
}
