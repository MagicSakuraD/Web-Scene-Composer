'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Camera, Circle, Plus, X } from 'lucide-react'
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
} from 'react-resizable-panels'
import {
  cameraViewerTopicsAtom,
  DEFAULT_CAMERA_COMPRESSED_TOPICS,
  FOXGLOVE_WS_URL,
} from '@/lib/ros/atoms'
import {
  dataSourceActiveAtom,
  dataSourceModeAtom,
  mcapTopicsAtom,
  topicVisibilityAtom,
} from '@/lib/playback/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { cameraFrameStore, type CameraFrameSnapshot } from '@/lib/ros/camera-frame-store'
import {
  isCameraImageTopic,
  preferCompressedCameraTopics,
  resolvePreferredCameraTopic,
} from '@/lib/foxglove/ros-serialization'
import { cn } from '@/lib/utils'

const EMPTY_TOPICS: readonly string[] = []

function useAvailableCameraTopics() {
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const mcapTopics = useAtomValue(mcapTopicsAtom)

  const liveTopics = useSyncExternalStore(
    (onStoreChange) => {
      if (dataSourceMode !== 'live' || !dataSourceActive) return () => {}
      return foxgloveManager.onTopicsChanged(onStoreChange)
    },
    () =>
      dataSourceMode === 'live' && dataSourceActive
        ? foxgloveManager.getCameraImageTopics()
        : EMPTY_TOPICS,
    () => EMPTY_TOPICS,
  )

  if (dataSourceMode === 'replay' && dataSourceActive) {
    return preferCompressedCameraTopics(
      mcapTopics
        .filter((t) => isCameraImageTopic(t.topic, t.schemaName))
        .map((t) => t.topic),
    )
  }

  return liveTopics
}

function CameraTile({
  topic,
  onRemove,
}: {
  topic: string
  onRemove: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const frame = useSyncExternalStore(
    (cb) => cameraFrameStore.subscribe(cb),
    () => cameraFrameStore.getFrame(topic),
    () => undefined as CameraFrameSnapshot | undefined,
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return cameraFrameStore.registerCanvas(topic, canvas)
  }, [topic])

  const stamp =
    frame && frame.stampSec > 0
      ? `${frame.stampSec}.${String(frame.stampNanosec).padStart(9, '0').slice(0, 3)}`
      : '—'

  return (
    <div className="h-full min-h-[120px] flex flex-col bg-black/90 border border-border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1 bg-panel-header border-b border-border shrink-0">
        <Camera className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[10px] font-mono truncate flex-1" title={topic}>
          {topic}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0">
          {frame?.fps ? `${frame.fps.toFixed(0)} fps` : '— fps'}
        </span>
        <button
          type="button"
          className="p-0.5 rounded hover:bg-accent text-muted-foreground shrink-0"
          title="关闭 Topics 中该图像话题（停止订阅）"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center relative">
        <canvas
          ref={canvasRef}
          className={cn(
            'max-w-full max-h-full object-contain',
            frame?.hasImage ? 'block' : 'hidden',
          )}
        />
        {!frame?.hasImage && (
          <p className="text-xs text-muted-foreground px-4 text-center">
            等待图像帧…
          </p>
        )}
      </div>

      <div className="px-2 py-1 border-t border-border text-[10px] text-muted-foreground font-mono shrink-0 flex gap-3">
        <span>
          {frame?.width && frame?.height ? `${frame.width}×${frame.height}` : '—'}
        </span>
        <span>{frame?.encoding ?? '—'}</span>
        <span className="truncate" title={frame?.frameId}>
          {frame?.frameId ?? '—'}
        </span>
        <span>t={stamp}</span>
      </div>
    </div>
  )
}

function CameraPanelGrid({
  topics,
  onRemove,
}: {
  topics: string[]
  onRemove: (topic: string) => void
}) {
  if (topics.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground p-6">
        <Camera className="h-10 w-10 opacity-40" />
        <p className="text-sm">尚未启用图像话题</p>
        <p className="text-xs text-center max-w-sm">
          在左侧 Topics 树中点击图像话题旁的眼睛，或使用上方快捷添加（等同打开眼睛）。
        </p>
      </div>
    )
  }

  if (topics.length === 1) {
    return (
      <div className="flex-1 min-h-0 p-2">
        <CameraTile topic={topics[0]} onRemove={() => onRemove(topics[0])} />
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 p-2">
      <PanelGroup orientation="horizontal" className="h-full min-h-[160px] gap-1">
        {topics.map((topic, index) => (
          <div key={topic} className="contents">
            {index > 0 && (
              <PanelResizeHandle className="w-1.5 rounded bg-border hover:bg-primary transition-colors cursor-col-resize" />
            )}
            <Panel defaultSize={100 / topics.length} minSize={15}>
              <CameraTile topic={topic} onRemove={() => onRemove(topic)} />
            </Panel>
          </div>
        ))}
      </PanelGroup>
    </div>
  )
}

/**
 * 预览面板：列表 = Topics 眼睛已打开的图像话题（cameraViewerTopicsAtom）。
 * 添加/移除只改 topicVisibility，订阅由 PlaybackRuntime 统一处理。
 */
export function CameraViewerPanel() {
  const previewTopics = useAtomValue(cameraViewerTopicsAtom)
  const [topicInput, setTopicInput] = useState('')
  const dataSourceActive = useAtomValue(dataSourceActiveAtom)
  const dataSourceMode = useAtomValue(dataSourceModeAtom)
  const setTopicVisibility = useSetAtom(topicVisibilityAtom)
  const availableTopics = useAvailableCameraTopics()
  const simActive = dataSourceActive

  const suggestions = useMemo(() => {
    const q = topicInput.trim().toLowerCase()
    const pool = availableTopics.length > 0 ? availableTopics : previewTopics
    if (!q) return pool
    return pool.filter((t) => t.toLowerCase().includes(q))
  }, [availableTopics, previewTopics, topicInput])

  /** 启用图像话题 = 打开 Topics 眼睛 */
  const enableTopic = useCallback(
    (raw?: string) => {
      const resolved = resolvePreferredCameraTopic(raw ?? topicInput, availableTopics)
      if (!resolved) return
      setTopicVisibility((prev) => {
        if (prev[resolved] === true) return prev
        return { ...prev, [resolved]: true }
      })
      setTopicInput('')
    },
    [availableTopics, setTopicVisibility, topicInput],
  )

  /** raw → compressed：关旧眼睛、开新眼睛 */
  useEffect(() => {
    if (!simActive || availableTopics.length === 0 || previewTopics.length === 0) return

    const upgrades: Array<{ from: string; to: string }> = []
    for (const t of previewTopics) {
      const preferred = resolvePreferredCameraTopic(t, availableTopics)
      if (preferred !== t) upgrades.push({ from: t, to: preferred })
    }
    if (upgrades.length === 0) return

    setTopicVisibility((prev) => {
      const next = { ...prev }
      let changed = false
      for (const { from, to } of upgrades) {
        if (next[from]) {
          next[from] = false
          changed = true
        }
        if (next[to] !== true) {
          next[to] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [availableTopics, previewTopics, setTopicVisibility, simActive])

  /** 关闭眼睛 = 停止订阅与预览 */
  const disableTopic = useCallback(
    (topic: string) => {
      setTopicVisibility((prev) => ({ ...prev, [topic]: false }))
      cameraFrameStore.clearTopic(topic)
    },
    [setTopicVisibility],
  )

  const statusText = !simActive
    ? dataSourceMode === 'live' || dataSourceMode === 'idle'
      ? `请先点击标题栏 Simulate 连接 Foxglove Bridge (${FOXGLOVE_WS_URL})`
      : '请打开 .mcap 或连接 Bridge'
    : previewTopics.length > 0
      ? `已启用 ${previewTopics.length} 路图像 · 共 ${availableTopics.length} 个图像话题`
      : `未启用图像话题 — 在 Topics 点眼睛，或下方快捷添加（共 ${availableTopics.length} 个）`

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-3 space-y-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">摄像头画面</h3>
            <p className="text-[10px] text-muted-foreground">
              Topics 眼睛为总开关 · 本面板仅预览已启用话题
            </p>
          </div>
        </div>

        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
            simActive && previewTopics.length > 0
              ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
              : simActive
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                : 'border-border bg-muted/30 text-muted-foreground',
          )}
        >
          <Circle
            className={cn(
              'h-2 w-2 fill-current',
              simActive && previewTopics.length > 0
                ? 'text-green-500'
                : simActive
                  ? 'text-amber-500'
                  : 'text-muted-foreground',
            )}
          />
          {statusText}
        </div>

        {simActive && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  list="camera-topic-suggestions"
                  value={topicInput}
                  placeholder="/front_stereo_camera/left/image_raw"
                  className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') enableTopic()
                  }}
                />
                <datalist id="camera-topic-suggestions">
                  {availableTopics.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs hover:opacity-90 shrink-0"
                onClick={() => enableTopic()}
              >
                <Plus className="h-3.5 w-3.5" />
                启用
              </button>
            </div>

            {suggestions.length > 0 && topicInput.trim() && (
              <div className="flex flex-wrap gap-1">
                {suggestions.slice(0, 6).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="text-[10px] font-mono px-2 py-0.5 rounded border border-border hover:bg-accent truncate max-w-full"
                    onClick={() => enableTopic(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            {availableTopics.length > 0 && previewTopics.length === 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] text-muted-foreground w-full mb-0.5">
                  快捷启用：
                </span>
                {(availableTopics.length > 0
                  ? availableTopics
                  : DEFAULT_CAMERA_COMPRESSED_TOPICS
                )
                  .slice(0, 8)
                  .map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => enableTopic(t)}
                    >
                      {t}
                    </button>
                  ))}
              </div>
            )}
          </>
        )}
      </div>

      <CameraPanelGrid topics={previewTopics} onRemove={disableTopic} />
    </div>
  )
}
