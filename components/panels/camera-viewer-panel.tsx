'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useAtom, useAtomValue } from 'jotai'
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
  simulateStatusAtom,
} from '@/lib/ros/atoms'
import { foxgloveManager } from '@/lib/foxglove/client-manager'
import { cameraFrameStore, type CameraFrameSnapshot } from '@/lib/ros/camera-frame-store'
import { resolvePreferredCameraTopic } from '@/lib/foxglove/ros-serialization'
import { useCameraViewer } from '@/hooks/use-camera-viewer'
import { cn } from '@/lib/utils'

const EMPTY_TOPICS: readonly string[] = []

function useAvailableCameraTopics() {
  const status = useAtomValue(simulateStatusAtom)
  const connected = status === 'connected'

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!connected) return () => {}
      return foxgloveManager.onTopicsChanged(onStoreChange)
    },
    () => (connected ? foxgloveManager.getCameraImageTopics() : EMPTY_TOPICS),
    () => EMPTY_TOPICS,
  )
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

  // 挂载 canvas → store 同步绘制（支持左右双路同时显示）
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
          title="移除此画面"
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
            等待 H.264 帧…（需 Chromium / Edge WebCodecs）
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
        <p className="text-sm">尚未添加摄像头话题</p>
        <p className="text-xs text-center max-w-sm">
          在上方选择压缩话题（如 {DEFAULT_CAMERA_COMPRESSED_TOPICS[0]}），点击添加。
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

export function CameraViewerPanel() {
  const [selectedTopics, setSelectedTopics] = useAtom(cameraViewerTopicsAtom)
  const [topicInput, setTopicInput] = useState('')
  const simulateStatus = useAtomValue(simulateStatusAtom)
  const availableTopics = useAvailableCameraTopics()
  const simActive = simulateStatus === 'connected'

  useCameraViewer(selectedTopics, true)

  const suggestions = useMemo(() => {
    const q = topicInput.trim().toLowerCase()
    const pool = availableTopics.length > 0 ? availableTopics : selectedTopics
    if (!q) return pool
    return pool.filter((t) => t.toLowerCase().includes(q))
  }, [availableTopics, selectedTopics, topicInput])

  const addTopic = useCallback(
    (raw?: string) => {
      const resolved = resolvePreferredCameraTopic(raw ?? topicInput, availableTopics)
      if (!resolved) return
      if (selectedTopics.includes(resolved)) {
        setTopicInput('')
        return
      }
      setSelectedTopics([...selectedTopics, resolved])
      setTopicInput('')
    },
    [availableTopics, selectedTopics, setSelectedTopics, topicInput],
  )

  /** 已选 raw 话题在 Bridge 有 compressed 时自动升级 */
  useEffect(() => {
    if (availableTopics.length === 0 || selectedTopics.length === 0) return
    const upgraded = selectedTopics.map((t) => resolvePreferredCameraTopic(t, availableTopics))
    const changed = upgraded.some((t, i) => t !== selectedTopics[i])
    if (!changed) return

    for (const old of selectedTopics) {
      if (!upgraded.includes(old)) cameraFrameStore.clearTopic(old)
    }
    setSelectedTopics(upgraded)
  }, [availableTopics, selectedTopics, setSelectedTopics])

  const removeTopic = useCallback(
    (topic: string) => {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic))
      cameraFrameStore.clearTopic(topic)
    },
    [selectedTopics, setSelectedTopics],
  )

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="p-3 space-y-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-medium">摄像头画面</h3>
            <p className="text-[10px] text-muted-foreground">
              sensor_msgs/CompressedImage (H.264) · WebCodecs 解码
            </p>
          </div>
        </div>

        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs flex items-center gap-2',
            simActive
              ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400'
              : 'border-border bg-muted/30 text-muted-foreground',
          )}
        >
          <Circle className={cn('h-2 w-2 fill-current', simActive ? 'text-green-500' : 'text-muted-foreground')} />
          {simActive
            ? `Foxglove 已连接 · 发现 ${availableTopics.length} 个图像话题`
            : `请先点击标题栏 Simulate 连接 Foxglove Bridge (${FOXGLOVE_WS_URL})`}
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              list="camera-topic-suggestions"
              value={topicInput}
              placeholder="/front_stereo_camera/left/image_raw/compressed"
              className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTopic()
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
            onClick={() => addTopic()}
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </button>
        </div>

        {suggestions.length > 0 && topicInput.trim() && (
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 6).map((t) => (
              <button
                key={t}
                type="button"
                className="text-[10px] font-mono px-2 py-0.5 rounded border border-border hover:bg-accent truncate max-w-full"
                onClick={() => addTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {availableTopics.length > 0 && selectedTopics.length === 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground w-full mb-0.5">快捷添加（H.264 compressed）：</span>
            {(availableTopics.length > 0 ? availableTopics : DEFAULT_CAMERA_COMPRESSED_TOPICS).map((t) => (
              <button
                key={t}
                type="button"
                className="text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => addTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <CameraPanelGrid topics={selectedTopics} onRemove={removeTopic} />
    </div>
  )
}
