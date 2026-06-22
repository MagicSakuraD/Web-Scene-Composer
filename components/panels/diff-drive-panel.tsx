'use client'

import { useAtom, useAtomValue } from 'jotai'
import { Gamepad2, Circle } from 'lucide-react'
import {
  cmdVelTuningAtom,
  lastCmdVelAtom,
  gamepadConnectedAtom,
  gamepadLabelAtom,
  simulateStatusAtom,
  cmdVelAdvertisedAtom,
  FOXGLOVE_WS_URL,
} from '@/lib/ros/atoms'
import { useGamepadCmdVel } from '@/hooks/use-gamepad-cmdvel'
import { useCmdVelChannel } from '@/hooks/use-cmd-vel-channel'
import { useGamepadDetection } from '@/hooks/use-gamepad-detection'
import { cn } from '@/lib/utils'

function TuningField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="flex-1 bg-input border border-border rounded px-2 py-1 text-xs"
      />
    </div>
  )
}

export function DiffDrivePanel() {
  const [tuning, setTuning] = useAtom(cmdVelTuningAtom)
  const lastCmd = useAtomValue(lastCmdVelAtom)
  const connected = useAtomValue(gamepadConnectedAtom)
  const label = useAtomValue(gamepadLabelAtom)
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const cmdVelAdvertised = useAtomValue(cmdVelAdvertisedAtom)

  useGamepadDetection(true)
  useCmdVelChannel(true)
  useGamepadCmdVel(true)

  const simActive = simulateStatus === 'connected'

  const gamepadHint = connected
    ? label
    : '未检测到 — 先点击本页面任意处，再按手柄 A/B/RT 等任意键唤醒'

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">差速驱动控制器</h3>
            <p className="text-[10px] text-muted-foreground">
              Gamepad → Web → Foxglove → ROS2 · geometry_msgs/Twist @ /cmd_vel
            </p>
          </div>
        </div>

        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
            simActive && cmdVelAdvertised
              ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
              : simActive
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-border bg-muted/30 text-muted-foreground',
          )}
        >
          <Circle
            className={cn(
              'h-2 w-2 fill-current',
              simActive && cmdVelAdvertised
                ? 'text-green-500'
                : simActive
                  ? 'text-amber-500'
                  : 'text-muted-foreground',
            )}
          />
          {!simActive
            ? `请先点击标题栏 Simulate 连接 Foxglove Bridge (${FOXGLOVE_WS_URL})`
            : cmdVelAdvertised
              ? '已 advertise /cmd_vel — 手柄输入将发布 Twist 消息'
              : 'Simulate 已连接，正在等待 advertise /cmd_vel…'}
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium mb-2">Xbox 映射（参考 Forza Horizon 5）</p>
          <ul className="text-[11px] text-muted-foreground space-y-1 leading-relaxed">
            <li><strong>RT</strong> — 加速（linear.x 正向）</li>
            <li><strong>LT</strong> — 刹车 / 倒车（linear.x 负向）</li>
            <li><strong>左摇杆 X</strong> — 原地转向（angular.z）</li>
            <li>linear.y / linear.z / angular.x / angular.y 锁定为 0</li>
          </ul>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium mb-2">速度参数</p>
          <TuningField
            label="Max linear.x (m/s)"
            value={tuning.maxLinear}
            step={0.05}
            min={0}
            max={3}
            onChange={(v) => setTuning((t) => ({ ...t, maxLinear: v }))}
          />
          <TuningField
            label="Max angular.z (rad/s)"
            value={tuning.maxAngular}
            step={0.05}
            min={0}
            max={2}
            onChange={(v) => setTuning((t) => ({ ...t, maxAngular: v }))}
          />
          <TuningField
            label="Stick deadzone"
            value={tuning.deadzone}
            step={0.01}
            min={0}
            max={0.5}
            onChange={(v) => setTuning((t) => ({ ...t, deadzone: v }))}
          />
          <TuningField
            label="Publish rate (Hz)"
            value={tuning.publishHz}
            step={1}
            min={5}
            max={50}
            onChange={(v) => setTuning((t) => ({ ...t, publishHz: v }))}
          />
        </div>

        <div className="rounded-md border border-border p-3 font-mono text-xs">
          <p className="text-muted-foreground mb-1">当前输出</p>
          <p>linear.x: {lastCmd.linearX.toFixed(3)}</p>
          <p>angular.z: {lastCmd.angularZ.toFixed(3)}</p>
          <p className="mt-2 text-muted-foreground">
            手柄: {gamepadHint}
          </p>
          {connected && !cmdVelAdvertised && simActive && (
            <p className="mt-1 text-amber-600 dark:text-amber-400">
              手柄已识别，等待 /cmd_vel advertise 完成后开始发布
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
