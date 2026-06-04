'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  usePanelRef,
} from 'react-resizable-panels'
import { TitleBar } from '@/components/title-bar'
import { SceneHierarchy } from '@/components/scene-hierarchy'
import { Viewport } from '@/components/viewport'
import { Inspector } from '@/components/inspector'
import { ProjectBrowser } from '@/components/project-browser'

export default function WebSceneComposer() {
  const [bottomCollapsed, setBottomCollapsed] = useState(false)
  const bottomPanelRef = usePanelRef()

  const handleBottomToggle = useCallback(() => {
    const panel = bottomPanelRef.current
    if (panel) {
      if (panel.isCollapsed()) {
        panel.expand()
      } else {
        panel.collapse()
      }
    }
  }, [bottomPanelRef])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      {/* Title bar */}
      <TitleBar />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="vertical" className="h-full">
          {/* Top section - main editing area */}
          <Panel defaultSize="70%" minSize="30%">
            <PanelGroup orientation="horizontal" className="h-full">
              {/* Left sidebar - Scene Hierarchy */}
              <Panel 
                defaultSize="15%" 
                minSize="180px" 
                maxSize="30%"
              >
                <SceneHierarchy />
              </Panel>

              <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

              {/* Center - Viewport */}
              <Panel 
                defaultSize="60%" 
                minSize="30%"
              >
                <Viewport />
              </Panel>

              <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

              {/* Right sidebar - Inspector */}
              <Panel 
                defaultSize="25%" 
                minSize="220px" 
                maxSize="35%"
              >
                <Inspector />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors cursor-row-resize" />

          {/* Bottom section - Project Browser */}
          <Panel
            panelRef={bottomPanelRef}
            defaultSize="30%"
            minSize="150px"
            maxSize="50%"
            collapsible
            collapsedSize="40px"
            onResize={(size) => {
              const panel = bottomPanelRef.current
              if (panel) {
                setBottomCollapsed(panel.isCollapsed())
              }
            }}
          >
            <ProjectBrowser
              isCollapsed={bottomCollapsed}
              onToggleCollapse={handleBottomToggle}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
