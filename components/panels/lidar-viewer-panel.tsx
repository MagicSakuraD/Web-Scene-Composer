'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { Circle, Radar } from 'lucide-react'
import {
  DEFAULT_LIDAR_TOPIC,
  FOXGLOVE_WS_URL,
  lidarDisplayAtom,
} from '@/lib/ros/atoms'
import {
  dataSourceActiveAtom,
  dataSourceModeAtom,
  mcapTopicsAtom,
} from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { isLidarPointCloudTopic } from '@/lib/foxglove/ros-serialization'
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
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const mcapTopics = useAtomValue(mcapTopicsAtom)

  const liveTopics = useSyncExternalStore(
    (onStoreChange) => {
      if (dataSourceMode !== 'live' || !dataSourceActive) return () => {}
      return foxgloveManager.onLidarTopicsChanged(onStoreChange)
    },
    () =>
      dataSourceMode === 'live' && dataSourceActive
        ? foxgloveManager.getLidarTopics()
        : EMPTY_TOPICS,
    () => EMPTY_TOPICS,
  )

  if (dataSourceMode === 'replay' && dataSourceActive) {
    return mcapTopics
      .filter((t) => isLidarPointCloudTopic(t.topic, t.schemaName))
      .map((t) => t.topic)
      .sort()
  }

  return liveTopics
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
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

/** 回放模式：只读状态（设置在 Topic 树内） */
function ReplayLidarStatus() {
  const config = useAtomValue(lidarDisplayAtom)
  const snapshot = useLidarSnapshot()
  const simActive = useAtomValue(dataSourceActiveAtom)

  return (
    <div className="h-full min-h-0 flex flex-col p-4 gap-3">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-primary shrink-0" />
        <div>
          <h3 className="text-sm font-medium">雷达点云</h3>
          <p className="text-[10px] text-muted-foreground">
            在左侧 Topics 中点眼睛启用点云话题，展开后可配置着色
          </p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
          simActive && config.visible && snapshot.pointCount > 0
            ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
            : simActive && config.visible
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
              : 'border-border bg-muted/30 text-muted-foreground',
        )}
      >
        <Circle
          className={cn(
            'h-2 w-2 fill-current',
            simActive && config.visible && snapshot.pointCount > 0
              ? 'text-green-500'
              : simActive && config.visible
                ? 'text-amber-500'
                : 'text-muted-foreground',
          )}
        />
        {!config.visible
          ? '未启用点云话题 — 在 Topics 树中点击眼睛图标'
          : snapshot.pointCount > 0
            ? `${config.topic} · ${snapshot.pointCount.toLocaleString()} 点 · ${snapshot.fps.toFixed(0)} Hz · ${snapshot.frameId || '—'}`
            : `${config.topic} · 已订阅，等待点云帧…`}
      </div>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        WebGPU 固定 {LIDAR_WEBGPU_FIXED_POINT_PX}px 点径。同时仅渲染一个点云话题；
        开启新话题会自动关闭先前启用的点云。
      </p>
    </div>
  )
}

/** Live / Compose：完整配置面板 */
function LiveLidarPanel() {
  const [config, setConfig] = useAtom(lidarDisplayAtom)
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const availableTopics = useAvailableLidarTopics()
  const snapshot = useLidarSnapshot()
  const simActive = dataSourceActive

  const setTopic = useCallback(
    (topic: string) => setConfig((c) => ({ ...c, topic: topic.trim() })),
    [setConfig],
  )

  return (
    <div className="h-full min-h-0 flex flex-col p-3 gap-3">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Radar className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-medium">雷达点云</h3>
            <p className="text-[10px] text-muted-foreground truncate">
              PointCloud · WebGPU 固定 {LIDAR_WEBGPU_FIXED_POINT_PX}px 点径
            </p>
          </div>
        </div>
        <div
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs flex items-center gap-2 shrink-0',
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
              ? `${snapshot.pointCount.toLocaleString()} 点 · ${snapshot.fps.toFixed(0)} Hz · ${snapshot.frameId || '—'}`
              : '已连接，等待点云帧…'}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-row gap-3">
        <div className="flex-1 min-w-0 rounded-md border border-border bg-card/40 p-3 flex flex-col overflow-hidden">
          <p className="text-xs font-medium mb-2 shrink-0">话题</p>
          <SettingRow label="PointCloud">
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
          <div className="flex-1 min-h-0 overflow-y-auto mt-2">
            {availableTopics.length > 0 ? (
              <div className="flex flex-wrap gap-1 content-start">
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
            ) : (
              <button
                type="button"
                className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary"
                onClick={() => setTopic(DEFAULT_LIDAR_TOPIC)}
              >
                {DEFAULT_LIDAR_TOPIC}
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 rounded-md border border-border bg-card/40 p-3 flex flex-col overflow-y-auto">
          <p className="text-xs font-medium mb-2 shrink-0">显示设置</p>
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
          <SettingRow label="绑定雷达">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={config.followRobot}
                onChange={(e) => setConfig((c) => ({ ...c, followRobot: e.target.checked }))}
              />
              attach 到机器人（/tf 或 glTF link）
            </label>
          </SettingRow>
          <SettingRow label="着色">
            <select
              value={config.colorMode}
              className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  colorMode: e.target.value as 'distance' | 'turbo' | 'solid',
                }))
              }
            >
              <option value="distance">距离彩虹 (GPU)</option>
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
        </div>
      </div>
    </div>
  )
}

export function LidarViewerPanel() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  if (dataSourceMode === 'replay') return <ReplayLidarStatus />
  return <LiveLidarPanel />
}
