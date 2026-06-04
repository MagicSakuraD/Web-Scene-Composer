'use client'

import {
  Menu,
  List,
  AlertTriangle,
  Settings,
  Eye,
  MessageSquare,
  Plus,
  PanelRight,
  Maximize,
  Minimize,
} from 'lucide-react'

export function TitleBar() {
  return (
    <div className="flex items-center h-10 px-2 bg-[oklch(0.12_0_0)] border-b border-border select-none">
      {/* macOS-style window controls (decorative) */}
      <div className="flex items-center gap-1.5 px-2">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
      </div>

      {/* Left actions */}
      <div className="flex items-center gap-1 ml-4">
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Menu className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <List className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
        </button>
      </div>

      {/* Title */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-sm font-medium">Web Scene Composer</span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Settings className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Eye className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-border mx-1" />
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <Plus className="h-4 w-4" />
        </button>
        <button className="p-1.5 rounded hover:bg-accent text-muted-foreground">
          <PanelRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
