'use client'

import { useCmdVelChannel } from '@/hooks/use-cmd-vel-channel'
import { useGamepadCmdVel } from '@/hooks/use-gamepad-cmdvel'
import { useGamepadDetection } from '@/hooks/use-gamepad-detection'

/** Tab 存在即运行：切换面板不卸载，仅关闭 Tab 时取消 advertise /cmd_vel */
export function DiffDriveRuntime() {
  useGamepadDetection(true)
  useCmdVelChannel(true)
  useGamepadCmdVel(true)
  return null
}
