'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Circle, Radar } from 'lucide-react'
import {
  DEFAULT_LIDAR_TOPIC,
  FOXGLOVE_WS_URL,
  lidarDisplayAtom,
  simulateStatusAtom,
} from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { lidarPointStore, type LidarCloudSnapshot } from '@/lib/ros/lidar-point-store'
import { LIDAR_WEBGPU_FIXED_POINT_PX } from '@/lib/viewport/visual-config'
import { cn } from '@/lib/utils'

const EMPTY_TOPICS: readonly string[] = []

const SSR_LIDAR_SNAPSHOT: LidarCloudSnapshot = {
  topic: '',
  pointCount: 0,
  frameId: '',
  stampSec: 0,
  stampNanosec: 0,
  fps: 0,
  updatedAt: 0,
  generation: 0,
  heightMin: 0,
  heightMax: 1,
}

function useAvailableLidarTopics() {
  const status = useAtomValue(simulateStatusAtom)
  const connected = status === 'connected'

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!connected) return () => {}
      return foxgloveManager.onLidarTopicsChanged(onStoreChange)
    },
    () => (connected ? foxgloveManager.getLidarTopics() : EMPTY_TOPICS),
    () => EMPTY_TOPICS,
  )
}

function useLidarSnapshot() {
  return useSyncExternalStore(
    (cb) => lidarPointStore.subscribe(cb),
    () => lidarPointStore.getSnapshot(),
    () => SSR_LIDAR_SNAPSHOT,
  )
}

function SettingRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

export function LidarViewerPanel() {
  const [config, setConfig] = useAtom(lidarDisplayAtom)
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const availableTopics = useAvailableLidarTopics()
  const snapshot = useLidarSnapshot()
  const simActive = simulateStatus === 'connected'

  const setTopic = useCallback(
    (topic: string) => setConfig((c) => ({ ...c, topic: topic.trim() })),
    [setConfig],
  )

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary" />
        <div>
          <h3 className="text-sm font-medium">雷达点云</h3>
          <p className="text-[10px] text-muted-foreground">
            sensor_msgs/PointCloud2 · WebGPU 固定 {LIDAR_WEBGPU_FIXED_POINT_PX}px 点径
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
          simActive && snapshot.pointCount > 0
            ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
            : simActive
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-border bg-muted/30 text-muted-foreground',
        )}
      >
        <Circle
          className={cn(
            'h-2 w-2 fill-current',
            simActive && snapshot.pointCount > 0
              ? 'text-green-500'
              : simActive
                ? 'text-amber-500'
                : 'text-muted-foreground',
          )}
        />
        {!simActive
          ? `请先 Simulate 连接 Foxglove (${FOXGLOVE_WS_URL})`
          : snapshot.pointCount > 0
            ? `${snapshot.pointCount.toLocaleString()} 点 · ${snapshot.fps.toFixed(0)} Hz · ${snapshot.frameId}`
            : '已连接，等待点云帧…'}
      </div>

      <div className="rounded-md border border-border p-3 space-y-1">
        <p className="text-xs font-medium mb-2">话题</p>
        <SettingRow label="PointCloud2">
          <input
            type="text"
            list="lidar-topic-suggestions"
            value={config.topic}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs font-mono"
            onChange={(e) => setTopic(e.target.value)}
          />
          <datalist id="lidar-topic-suggestions">
            {availableTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </SettingRow>
        {availableTopics.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {availableTopics.map((t) => (
              <button
                key={t}
                type="button"
                className={cn(
                  'text-[10px] font-mono px-2 py-0.5 rounded border',
                  config.topic === t
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border hover:bg-accent',
                )}
                onClick={() => setTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {availableTopics.length === 0 && (
          <button
            type="button"
            className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary"
            onClick={() => setTopic(DEFAULT_LIDAR_TOPIC)}
          >
            {DEFAULT_LIDAR_TOPIC}
          </button>
        )}
      </div>

      <div className="rounded-md border border-border p-3 space-y-1">
        <p className="text-xs font-medium mb-2">显示</p>
        <SettingRow label="视口可见">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.visible}
              onChange={(e) => setConfig((c) => ({ ...c, visible: e.target.checked }))}
            />
            在 3D 视口渲染点云
          </label>
        </SettingRow>
        <SettingRow label="绑定雷达节点">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.followRobot}
              onChange={(e) => setConfig((c) => ({ ...c, followRobot: e.target.checked }))}
            />
            attach 到机器人：优先 /tf 雷达位姿，回退 glTF link
          </label>
        </SettingRow>
        <SettingRow label="着色">
          <select
            value={config.colorMode}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                colorMode: e.target.value as 'turbo' | 'solid',
              }))
            }
          >
            <option value="turbo">Turbo 高度渐变 (GPU)</option>
            <option value="solid">单色</option>
          </select>
        </SettingRow>
        {config.colorMode === 'solid' && (
          <SettingRow label="颜色">
            <input
              type="color"
              value={config.color}
              className="h-7 w-12 rounded border border-border bg-transparent"
              onChange={(e) => setConfig((c) => ({ ...c, color: e.target.value }))}
            />
          </SettingRow>
        )}
        <SettingRow label="透明度">
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={config.opacity}
            className="w-full"
            onChange={(e) =>
              setConfig((c) => ({ ...c, opacity: parseFloat(e.target.value) }))
            }
          />
        </SettingRow>
        {/* 绕 X / Y 外参已固定：X=+90°（Isaac XT_32），Y=0；不再暴露面板调节 */}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        WebGPU 下点径不可调。Turbo 色图按每帧点云高度自动映射。
        点云 frame_id 为 front_3d_lidar，挂载场景节点 chassis_link/sensors/XT_32（对应 PandarXT_32_10hz）。
        无 XT_32 节点时回退 /tf（base_link→front_3d_lidar）。
      </p>
    </div>
  )
}
