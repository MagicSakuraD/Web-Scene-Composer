'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Radio } from 'lucide-react'
import { useAtom, useAtomValue } from 'jotai'
import {
  mcapTopicsAtom,
  selectedTopicAtom,
  topicVisibilityAtom,
  type McapTopicInfo,
} from '@/lib/playback/atoms'
import { lidarDisplayAtom, type LidarColorMode } from '@/lib/ros/atoms'
import { isLidarPointCloudTopic } from '@/lib/foxglove/ros-serialization'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/use-i18n'

function PointCloudInlineSettings({ topic }: { topic: string }) {
  const [config, setConfig] = useAtom(lidarDisplayAtom)
  const isActive = config.topic === topic && config.visible
  const { t } = useI18n()

  if (!isActive) {
    return (
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground">
        {t('playback.topicTree.enableToConfigure')}
      </div>
    )
  }

  return (
    <div className="px-2 py-2 space-y-1.5 border-t border-border/60">
      <label className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-muted-foreground">{t('playback.topicTree.colorMode')}</span>
        <select
          value={config.colorMode}
          className="flex-1 max-w-[9rem] bg-input border border-border rounded px-1.5 py-0.5 text-[10px]"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            setConfig((c) => ({
              ...c,
              colorMode: e.target.value as LidarColorMode,
            }))
          }
        >
          <option value="distance">{t('playback.topicTree.colorDistance')}</option>
          <option value="turbo">{t('playback.topicTree.colorTurbo')}</option>
          <option value="solid">{t('playback.topicTree.colorSolid')}</option>
        </select>
      </label>
      {config.colorMode === 'solid' && (
        <label className="flex items-center justify-between gap-2 text-[10px]">
          <span className="text-muted-foreground">{t('playback.topicTree.color')}</span>
          <input
            type="color"
            value={config.color}
            className="h-5 w-10 rounded border border-border bg-transparent"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setConfig((c) => ({ ...c, color: e.target.value }))}
          />
        </label>
      )}
      <label className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-muted-foreground">{t('playback.topicTree.opacity')}</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={config.opacity}
          className="flex-1 max-w-[9rem]"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) =>
            setConfig((c) => ({ ...c, opacity: parseFloat(e.target.value) }))
          }
        />
      </label>
    </div>
  )
}

function TopicRow({ item }: { item: McapTopicInfo }) {
  const [selected, setSelected] = useAtom(selectedTopicAtom)
  const [visibility, setVisibility] = useAtom(topicVisibilityAtom)
  const [expanded, setExpanded] = useState(false)
  const { t } = useI18n()

  const visible = visibility[item.topic] === true
  const isSelected = selected === item.topic
  const isPointCloud = isLidarPointCloudTopic(item.topic, item.schemaName)
  const showSettings = isPointCloud && expanded

  return (
    <div
      className={cn(
        'mx-1 mb-0.5 rounded-md overflow-hidden',
        isSelected && 'bg-selection-accent/20 ring-1 ring-selection-accent/40',
        visible && isPointCloud && 'bg-primary/5',
      )}
    >
      <div
        className={cn(
          'group flex items-center gap-1 py-1 px-1.5 cursor-pointer text-sm select-none transition-colors min-w-0',
          isSelected ? 'text-foreground' : 'hover:bg-accent/40 text-foreground/90',
          !visible && 'text-foreground/45',
        )}
        onClick={() => {
          setSelected(item.topic)
          if (isPointCloud) setExpanded((v) => !v)
        }}
      >
        {isPointCloud ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-accent/80 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <Radio className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
        <div className="flex-1 min-w-0">
          <div className="truncate font-mono text-xs">{item.topic}</div>
          <div className="truncate text-[10px] font-mono text-muted-foreground">
            {item.schemaName}
          </div>
        </div>
        <button
          type="button"
          className={cn(
            'p-0.5 rounded flex-shrink-0 transition-opacity',
            visible
              ? 'opacity-100 text-primary'
              : 'opacity-40 group-hover:opacity-100 text-muted-foreground hover:text-foreground',
          )}
          title={visible ? t('playback.topicTree.hide') : t('playback.topicTree.show')}
          onClick={(e) => {
            e.stopPropagation()
            setVisibility((prev) => ({ ...prev, [item.topic]: !visible }))
            if (!visible && isPointCloud) setExpanded(true)
          }}
        >
          {visible ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {showSettings && <PointCloudInlineSettings topic={item.topic} />}
    </div>
  )
}

export function TopicTree() {
  const topics = useAtomValue(mcapTopicsAtom)
  const { t } = useI18n()

  if (topics.length === 0) {
    return (
      <div className="h-full flex flex-col flex-1 min-w-0 bg-muted/20 text-sidebar-foreground">
        <div className="px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('playback.topicTree.title')}
        </div>
        <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground text-center">
          {t('playback.topicTree.empty')}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col flex-1 min-w-0 bg-muted/20 text-sidebar-foreground overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('playback.topicTree.title')}
        </span>
        <span className="text-[10px] text-muted-foreground truncate">
          {t('playback.topicTree.hint')}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {topics.map((item) => (
          <TopicRow key={item.topic} item={item} />
        ))}
      </div>
    </div>
  )
}
