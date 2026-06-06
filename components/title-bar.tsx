'use client'

import {
  List,
  AlertTriangle,
  MousePointer2,
  Move,
  RotateCw,
  Maximize2,
  Globe,
  Box,
  Play,
  Camera,
  PanelLeft,
  PanelRight,
  Plus,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

export function TitleBar() {
  return (
    <div className="flex items-center h-11 px-2 bg-toolbar text-toolbar-foreground border-b border-border select-none">
      {/* Left actions */}
      <div className="flex items-center gap-0.5 ml-3">
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="导航器">
          <List className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-amber-500" title="问题">
          <AlertTriangle className="h-4 w-4" />
        </button>
        <span className="ml-2 text-sm font-semibold text-foreground">RealityKitContent</span>
      </div>

      {/* Center - transform controls */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
          <button className="p-1.5 rounded bg-accent text-foreground" title="选择">
            <MousePointer2 className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="移动">
            <Move className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="旋转">
            <RotateCw className="h-4 w-4" />
          </button>
          <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="缩放">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="w-px h-5 bg-border mx-2" />

        {/* Local / World space switch */}
        <div className="flex items-center gap-0.5 rounded-md bg-accent/40 p-0.5">
          <button className="flex items-center gap-1 px-2 py-1 rounded bg-accent text-foreground text-xs" title="世界空间">
            <Globe className="h-3.5 w-3.5" />
            World
          </button>
          <button className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent text-toolbar-foreground text-xs" title="本地空间">
            <Box className="h-3.5 w-3.5" />
            Local
          </button>
        </div>

        <div className="w-px h-5 bg-border mx-2" />

        {/* Play */}
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="播放">
          <Play className="h-4 w-4" />
        </button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="相机设置">
          <Camera className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="添加">
          <Plus className="h-4 w-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <ThemeToggle />
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="切换导航器">
          <PanelLeft className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-toolbar-foreground" title="切换检视器">
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
