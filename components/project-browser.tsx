'use client'

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Search,
  Sliders,
  BarChart3,
  Volume2,
  Sparkles,
  FileBox,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

interface FolderNode {
  id: string
  name: string
  children?: FolderNode[]
  expanded?: boolean
}

const collectionsData: FolderNode[] = [
  { id: 'all-files', name: 'All Files' },
]

const projectData: FolderNode[] = [
  {
    id: 'hlreview',
    name: 'HLReview.rkassets',
    expanded: true,
    children: [
      {
        id: 'props',
        name: 'Props',
        expanded: true,
        children: [
          { id: 'architecture', name: 'Architecture' },
          { id: 'boats', name: 'Boats' },
          { id: 'furniture', name: 'Furniture' },
          { id: 'rocks', name: 'Rocks' },
          { id: 'vegetation', name: 'Vegetation' },
        ],
      },
    ],
  },
]

const assetItems = [
  { id: 'beach-umbrella', name: 'BeachUmbrella.usdz', color: 'bg-pink-600' },
  { id: 'helicopter', name: 'Helicopter.usdz', color: 'bg-gray-500' },
  { id: 'saguaro-cactus', name: 'SaguaroCactus.usdz', color: 'bg-green-600' },
  { id: 'sailboat', name: 'SailBoat.usdz', color: 'bg-amber-700' },
  { id: 'sand-ramp', name: 'SandRamp.usdz', color: 'bg-yellow-600' },
  { id: 'scene', name: 'Scene.usda', color: 'bg-gray-400' },
  { id: 'street', name: 'Street.usdz', color: 'bg-gray-600' },
  { id: 'telecom-tower', name: 'TelecommunicationTower.usdz', color: 'bg-gray-500' },
  { id: 'beach-boat', name: 'beach_boat.usdz', color: 'bg-amber-800' },
]

const tabs = [
  { id: 'project-browser', name: 'Project Browser', icon: FileBox },
  { id: 'shader-graph', name: 'Shader Graph', icon: Sparkles },
  { id: 'behaviors', name: 'Behaviors', icon: Sliders },
  { id: 'audio-mixer', name: 'Audio Mixer', icon: Volume2 },
  { id: 'statistics', name: 'Statistics', icon: BarChart3 },
]

interface FolderItemProps {
  node: FolderNode
  level: number
}

function FolderItem({ node, level }: FolderItemProps) {
  const [expanded, setExpanded] = useState(node.expanded ?? false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 px-1 hover:bg-accent/50 rounded cursor-pointer text-xs select-none"
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {hasChildren ? (
          expanded ? (
            <FolderOpen className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
          )
        ) : (
          <Folder className="h-3.5 w-3.5 text-yellow-500 flex-shrink-0" />
        )}
        <span className="text-foreground/90 truncate">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <FolderItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface ProjectBrowserProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ProjectBrowser({ isCollapsed, onToggleCollapse }: ProjectBrowserProps) {
  const [activeTab, setActiveTab] = useState('project-browser')

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-[oklch(0.16_0_0)]">
        <div className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.name}
              </button>
            )
          })}
        </div>
        <button
          className="p-2 hover:bg-accent text-muted-foreground"
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {isCollapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar - Collections/Project tree */}
          <div className="w-48 border-r border-border flex flex-col">
            {/* Collections */}
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Collections</span>
              </div>
              <div className="px-1 pb-1">
                <div className="flex items-center gap-1 py-0.5 px-2 bg-primary/20 rounded text-xs">
                  <LayoutGrid className="h-3 w-3" />
                  <span>All Files</span>
                </div>
              </div>
            </div>

            {/* Project tree */}
            <div className="flex-1 overflow-auto">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs font-medium text-muted-foreground">Project</span>
              </div>
              <div className="px-1 pb-2">
                {projectData.map((node) => (
                  <FolderItem key={node.id} node={node} level={0} />
                ))}
              </div>
            </div>
          </div>

          {/* Asset toolbar */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-[oklch(0.16_0_0)]">
              <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                <Plus className="h-4 w-4" />
              </button>
              <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                <Folder className="h-4 w-4" />
              </button>
              <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                <Sliders className="h-4 w-4" />
              </button>
              <div className="flex-1" />
              
              {/* View toggle */}
              <div className="flex items-center gap-1">
                <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button className="p-1 rounded hover:bg-accent text-muted-foreground">
                  <List className="h-4 w-4" />
                </button>
              </div>
              
              {/* Zoom slider placeholder */}
              <div className="w-20 h-1 bg-muted rounded-full mx-2">
                <div className="w-1/2 h-full bg-muted-foreground rounded-full" />
              </div>

              {/* Filter */}
              <div className="flex items-center gap-1 px-2 py-1 bg-input rounded text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span>Filter</span>
              </div>
            </div>

            {/* Asset grid */}
            <div className="flex-1 overflow-auto p-2">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
                {assetItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col items-center gap-1 p-2 rounded hover:bg-accent/50 cursor-pointer group"
                  >
                    <div className={`w-16 h-16 rounded ${item.color} flex items-center justify-center`}>
                      <FileBox className="h-8 w-8 text-white/70" />
                    </div>
                    <span className="text-[10px] text-center text-muted-foreground group-hover:text-foreground truncate w-full">
                      {item.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar - Properties */}
          <div className="w-48 border-l border-border flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center">
                Select a file to view its properties.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
