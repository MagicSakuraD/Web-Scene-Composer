'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Move3d } from 'lucide-react'
import { useAtom } from 'jotai'
import * as THREE from 'three'
import { tfDisplayAtom } from '@/lib/ros/atoms'
import {
  tfRuntimeStore,
  type TfEdge,
  type TfTreeNode,
} from '@/lib/ros/tf-runtime-store'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/use-i18n'

function useTfGeneration(): number {
  return useSyncExternalStore(
    (cb) => tfRuntimeStore.subscribe(cb),
    () => tfRuntimeStore.generation,
    () => tfRuntimeStore.generation,
  )
}

function rosQuatToRpyDeg(q: { x: number; y: number; z: number; w: number }) {
  const e = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion(q.x, q.y, q.z, q.w),
    'XYZ',
  )
  return {
    roll: THREE.MathUtils.radToDeg(e.x),
    pitch: THREE.MathUtils.radToDeg(e.y),
    yaw: THREE.MathUtils.radToDeg(e.z),
  }
}

function formatNum(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

function FrameRow({
  node,
  depth,
  selected,
  hiddenFrames,
  onSelect,
  onToggleVisible,
}: {
  node: TfTreeNode
  depth: number
  selected: string | null
  hiddenFrames: Record<string, boolean>
  onSelect: (frame: string) => void
  onToggleVisible: (frame: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selected === node.frame
  const visible = hiddenFrames[node.frame] !== true

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 py-0.5 pr-1.5 cursor-pointer text-sm select-none transition-colors min-w-0',
          isSelected
            ? 'bg-selection-accent/20 text-foreground'
            : 'hover:bg-accent/40 text-foreground/90',
          !visible && 'text-foreground/40',
        )}
        style={{ paddingLeft: 6 + depth * 12 }}
        onClick={() => onSelect(node.frame)}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-accent/80 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 opacity-70" />
            ) : (
              <ChevronRight className="h-3 w-3 opacity-50" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <Move3d className="h-3 w-3 flex-shrink-0 opacity-55" />
        <span className="flex-1 min-w-0 truncate font-mono text-xs">{node.frame}</span>
        <button
          type="button"
          className={cn(
            'p-0.5 rounded flex-shrink-0',
            visible
              ? 'opacity-100 text-primary'
              : 'opacity-40 group-hover:opacity-100 text-muted-foreground',
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleVisible(node.frame)
          }}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>
      {expanded &&
        node.children.map((child) => (
          <FrameRow
            key={child.frame}
            node={child}
            depth={depth + 1}
            selected={selected}
            hiddenFrames={hiddenFrames}
            onSelect={onSelect}
            onToggleVisible={onToggleVisible}
          />
        ))}
    </div>
  )
}

function FrameDetail({ edge, frame }: { edge: TfEdge | undefined; frame: string }) {
  const { t } = useI18n()
  if (!edge) {
    return (
      <div className="px-3 py-2 text-[10px] text-muted-foreground">
        {t('sidePanel.transforms.rootOrMissing', { frame })}
      </div>
    )
  }
  const { translation: tr, rotation: rot } = edge.transform
  const rpy = rosQuatToRpyDeg(rot)
  const ageMs = Math.max(0, performance.now() - edge.updatedAt)

  return (
    <div className="px-3 py-2 space-y-1.5 text-[10px] border-t border-border">
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{t('sidePanel.transforms.parent')}</span>
        <span className="font-mono truncate">{edge.parentFrame}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-muted-foreground">{t('sidePanel.transforms.age')}</span>
        <span className="font-mono tabular-nums">{formatNum(ageMs, 1)} ms</span>
      </div>
      <div>
        <div className="text-muted-foreground mb-0.5">{t('sidePanel.transforms.translation')}</div>
        <div className="font-mono tabular-nums grid grid-cols-3 gap-1">
          <span>X {formatNum(tr.x)}</span>
          <span>Y {formatNum(tr.y)}</span>
          <span>Z {formatNum(tr.z)}</span>
        </div>
      </div>
      <div>
        <div className="text-muted-foreground mb-0.5">{t('sidePanel.transforms.rotation')}</div>
        <div className="font-mono tabular-nums grid grid-cols-3 gap-1">
          <span>R {formatNum(rpy.roll, 1)}°</span>
          <span>P {formatNum(rpy.pitch, 1)}°</span>
          <span>Y {formatNum(rpy.yaw, 1)}°</span>
        </div>
      </div>
    </div>
  )
}

/** Foxglove-style Transforms side panel */
export function TransformsPanel() {
  const { t } = useI18n()
  const gen = useTfGeneration()
  const [config, setConfig] = useAtom(tfDisplayAtom)

  const tree = useMemo(() => tfRuntimeStore.getFrameTree(), [gen])
  const frames = useMemo(() => tfRuntimeStore.getFrameIds(), [gen])
  const selectedEdge = config.selectedFrame
    ? tfRuntimeStore.getEdge(config.selectedFrame)
    : undefined

  if (tree.length === 0) {
    return (
      <div className="h-full flex flex-col flex-1 min-w-0 bg-muted/20 text-sidebar-foreground">
        <div className="px-3 py-2 border-b border-border text-xs font-medium">
          {t('sidePanel.transforms.name')}
        </div>
        <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
          {t('sidePanel.transforms.empty')}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col flex-1 min-w-0 bg-muted/20 text-sidebar-foreground overflow-hidden">
      <div className="px-3 py-2 border-b border-border space-y-1.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium">{t('sidePanel.transforms.name')}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{frames.length}</span>
        </div>
        <label className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground">{t('sidePanel.transforms.showInScene')}</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig((c) => ({ ...c, enabled: e.target.checked }))}
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground">{t('sidePanel.transforms.fixedFrame')}</span>
          <select
            value={config.fixedFrame}
            className="flex-1 max-w-[10rem] bg-input border border-border rounded px-1.5 py-0.5 text-[10px] font-mono"
            onChange={(e) => setConfig((c) => ({ ...c, fixedFrame: e.target.value }))}
          >
            <option value="">{t('sidePanel.transforms.fixedAuto')}</option>
            {frames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground">{t('sidePanel.transforms.axisLength')}</span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={config.axisLength}
            className="flex-1 max-w-[9rem]"
            onChange={(e) =>
              setConfig((c) => ({ ...c, axisLength: parseFloat(e.target.value) }))
            }
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto py-1 min-h-0">
        {tree.map((node) => (
          <FrameRow
            key={node.frame}
            node={node}
            depth={0}
            selected={config.selectedFrame}
            hiddenFrames={config.hiddenFrames}
            onSelect={(frame) => setConfig((c) => ({ ...c, selectedFrame: frame }))}
            onToggleVisible={(frame) =>
              setConfig((c) => ({
                ...c,
                hiddenFrames: {
                  ...c.hiddenFrames,
                  [frame]: c.hiddenFrames[frame] !== true,
                },
              }))
            }
          />
        ))}
      </div>
      {config.selectedFrame ? (
        <FrameDetail edge={selectedEdge} frame={config.selectedFrame} />
      ) : null}
    </div>
  )
}
