'use client'

import {
  ChevronDown,
  ChevronUp,
  Plus,
  Filter,
  LayoutGrid,
  List,
  Search,
  FileBox,
  Terminal,
  Gamepad2,
  Camera,
  Radar,
  Layers,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { projectAssetsAtom } from '@/lib/scene/atoms'
import {
  bottomPanelTabsAtom,
  activeBottomTabIdAtom,
  type BottomPanelTab,
} from '@/lib/ros/atoms'
import { useAddSceneNode } from '@/lib/scene/use-add-scene-node'
import { GltfFileInput } from '@/components/gltf-file-input'
import { AddPanelMenu } from '@/components/add-panel-menu'
import { DiffDrivePanel } from '@/components/panels/diff-drive-panel'
import { DiffDriveRuntime } from '@/components/panels/diff-drive-runtime'
import { CameraViewerPanel } from '@/components/panels/camera-viewer-panel'
import { LidarViewerPanel } from '@/components/panels/lidar-viewer-panel'
import { MaterialGraphPanel } from '@/components/panels/material-graph-panel'
import { LidarRuntime } from '@/components/panels/lidar-runtime'
import { ConsolePanel } from '@/components/panels/console-panel'
import { useI18n } from '@/hooks/use-i18n'
import { panelNameKey } from '@/lib/i18n/panel-messages'
import { cn } from '@/lib/utils'

function tabIcon(type: BottomPanelTab['type']) {
  switch (type) {
    case 'project-browser':
      return FileBox
    case 'console':
      return Terminal
    case 'diff-drive':
      return Gamepad2
    case 'camera-viewer':
      return Camera
    case 'lidar-viewer':
      return Radar
    case 'material-graph':
      return Layers
    default:
      return FileBox
  }
}

interface ProjectBrowserProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function ProjectBrowser({ isCollapsed, onToggleCollapse }: ProjectBrowserProps) {
  const [tabs, setTabs] = useAtom(bottomPanelTabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeBottomTabIdAtom)
  const { t } = useI18n()
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const assets = useAtomValue(projectAssetsAtom)
  const { importGltfFile, addAssetFromUrl, fileInputRef, onFileInputChange } = useAddSceneNode()
  const importToLibraryOnly = useRef(false)

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]
  const hasDiffDriveTab = tabs.some((t) => t.type === 'diff-drive')
  const hasLidarTab = tabs.some((t) => t.type === 'lidar-viewer')

  const triggerImport = (toScene: boolean) => {
    importToLibraryOnly.current = !toScene
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void importGltfFile(file, !importToLibraryOnly.current)
    importToLibraryOnly.current = false
    e.target.value = ''
  }

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (tabs.length <= 1) return
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (activeTabId === id) setActiveTabId(next[0].id)
  }

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {hasDiffDriveTab && <DiffDriveRuntime />}
      {hasLidarTab && <LidarRuntime />}
      <GltfFileInput ref={fileInputRef} onChange={handleFileChange} />

      <div className="relative z-20 flex items-center border-b border-border bg-panel-header shrink-0">
        <div className="flex-1 flex items-center gap-1 px-2 py-1.5 overflow-x-auto min-w-0">
          {tabs.map((tab) => {
            const Icon = tabIcon(tab.type)
            const closable = tab.type !== 'project-browser'
            const nameKey = panelNameKey(tab.type)
            const label = nameKey ? t(nameKey) : tab.name
            return (
              <button
                key={tab.id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded text-xs whitespace-nowrap transition-colors group',
                  activeTabId === tab.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
                onClick={() => setActiveTabId(tab.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {closable && (
                  <span
                    className="ml-0.5 p-0.5 rounded hover:bg-background/80 opacity-0 group-hover:opacity-100"
                    onClick={(e) => closeTab(tab.id, e)}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
              </button>
            )
          })}
          <AddPanelMenu />
        </div>
        <button
          className="p-2 hover:bg-accent text-muted-foreground shrink-0"
          onClick={onToggleCollapse}
          title={isCollapsed ? t('projectBrowser.expandPanel') : t('projectBrowser.collapsePanel')}
        >
          {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && activeTab && (
        <div
          className={cn(
            'relative z-0 flex-1 min-h-0',
            activeTab.type === 'camera-viewer' || activeTab.type === 'material-graph'
              ? 'overflow-hidden flex flex-col'
              : 'overflow-y-auto overflow-x-hidden',
          )}
        >
          {activeTab.type === 'project-browser' && (
            <ProjectBrowserContent
              assets={assets}
              viewMode={viewMode}
              setViewMode={setViewMode}
              triggerImport={triggerImport}
              onAssetActivate={(url, name) => void addAssetFromUrl(url, name, false)}
            />
          )}
          {activeTab.type === 'console' && <ConsolePanel />}
          {activeTab.type === 'diff-drive' && <DiffDrivePanel />}
          {activeTab.type === 'camera-viewer' && <CameraViewerPanel />}
          {activeTab.type === 'lidar-viewer' && <LidarViewerPanel />}
          {activeTab.type === 'material-graph' && <MaterialGraphPanel />}
        </div>
      )}
    </div>
  )
}

function ProjectBrowserContent({
  assets,
  viewMode,
  setViewMode,
  triggerImport,
  onAssetActivate,
}: {
  assets: { id: string; name: string; url: string; kind: string }[]
  viewMode: 'list' | 'grid'
  setViewMode: (v: 'list' | 'grid') => void
  triggerImport: (toScene: boolean) => void
  onAssetActivate: (url: string, name: string) => void
}) {
  const { t } = useI18n()

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="w-44 border-r border-border flex flex-col">
        <div className="border-b border-border px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t('projectBrowser.assets')}</span>
        </div>
        <div className="flex-1 overflow-auto px-1 py-2">
          <div className="flex items-center gap-1 py-0.5 px-2 bg-selection-accent/15 rounded text-xs text-selection-accent">
            <LayoutGrid className="h-3 w-3" />
            {t('projectBrowser.gltfFormat')}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-panel-header">
          <button
            className="p-1 rounded hover:bg-accent text-muted-foreground"
            title={t('projectBrowser.importGltf')}
            onClick={() => triggerImport(false)}
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded bg-input border border-border max-w-xs">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder={t('projectBrowser.search')} className="flex-1 bg-transparent text-xs outline-none" />
          </div>
          <div className="flex items-center gap-0.5">
            <button
              className={cn('p-1 rounded', viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent')}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              className={cn('p-1 rounded', viewMode === 'grid' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent')}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 bg-input rounded text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            .glb / .gltf
          </div>
        </div>

        {assets.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileBox className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('projectBrowser.noAssets')}</p>
            <button
              className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:opacity-90"
              onClick={() => triggerImport(false)}
            >
              {t('projectBrowser.importGltf')}
            </button>
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-panel-header border-b border-border">
                <tr className="text-left text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium w-8" />
                  <th className="px-3 py-1.5 font-medium">{t('projectBrowser.name')}</th>
                  <th className="px-3 py-1.5 font-medium w-24">{t('projectBrowser.format')}</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 hover:bg-accent/40 cursor-pointer"
                    onDoubleClick={() => onAssetActivate(item.url, item.name)}
                  >
                    <td className="px-3 py-1.5">
                      <FileBox className="h-4 w-4 text-primary" />
                    </td>
                    <td className="px-3 py-1.5">{item.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground uppercase">{item.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-2">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-2">
              {assets.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col items-center gap-1 p-2 rounded hover:bg-accent/50 cursor-pointer"
                  onDoubleClick={() => onAssetActivate(item.url, item.name)}
                >
                  <div className="w-16 h-16 rounded bg-primary/20 flex items-center justify-center">
                    <FileBox className="h-8 w-8 text-primary/70" />
                  </div>
                  <span className="text-[10px] text-center text-muted-foreground truncate w-full">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
