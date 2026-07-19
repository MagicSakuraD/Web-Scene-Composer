'use client'

import { useCallback } from 'react'
import {
  Panel,
  Group as PanelGroup,
  Separator as PanelResizeHandle,
  usePanelRef,
  type PanelImperativeHandle,
} from 'react-resizable-panels'
import { useAtom } from 'jotai'
import { TitleBar } from '@/components/title-bar'
import { SceneHierarchy } from '@/components/scene-hierarchy'
import { Viewport } from '@/components/viewport'
import { Inspector } from '@/components/inspector'
import { ProjectBrowser } from '@/components/project-browser'
import { uiPanelsAtom } from '@/lib/scene/atoms'
import { PanelCollapseRail } from '@/components/panel-collapse-rail'
import { CreateContextMenu } from '@/components/create-context-menu'
import { I18nSync } from '@/components/i18n-sync'
import { SceneHistoryShortcuts } from '@/components/scene-history-shortcuts'

export default function WebSceneComposer() {
  const [uiPanels, setUiPanels] = useAtom(uiPanelsAtom)
  const leftPanelRef = usePanelRef()
  const rightPanelRef = usePanelRef()
  const bottomPanelRef = usePanelRef()

  const togglePanel = useCallback(
    (panelRef: React.RefObject<PanelImperativeHandle | null>, key: 'leftOpen' | 'rightOpen' | 'bottomOpen') => {
      const panel = panelRef.current
      if (!panel) return

      if (panel.isCollapsed()) {
        panel.expand()
        setUiPanels((prev) => ({ ...prev, [key]: true }))
      } else {
        panel.collapse()
        setUiPanels((prev) => ({ ...prev, [key]: false }))
      }
    },
    [setUiPanels],
  )

  const handleBottomToggle = useCallback(() => {
    togglePanel(bottomPanelRef, 'bottomOpen')
  }, [bottomPanelRef, togglePanel])

  const handleLeftToggle = useCallback(() => {
    togglePanel(leftPanelRef, 'leftOpen')
  }, [leftPanelRef, togglePanel])

  const handleRightToggle = useCallback(() => {
    togglePanel(rightPanelRef, 'rightOpen')
  }, [rightPanelRef, togglePanel])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <I18nSync />
      <SceneHistoryShortcuts />
      <CreateContextMenu />
      <TitleBar
        onToggleLeft={handleLeftToggle}
        onToggleRight={handleRightToggle}
        leftOpen={uiPanels.leftOpen}
        rightOpen={uiPanels.rightOpen}
      />

      <div className="flex-1 overflow-hidden">
        <PanelGroup orientation="vertical" className="h-full">
          <Panel defaultSize="70%" minSize="30%">
            <PanelGroup orientation="horizontal" className="h-full">
              <Panel
                panelRef={leftPanelRef}
                defaultSize="18%"
                minSize="180px"
                maxSize="30%"
                collapsible
                collapsedSize="0px"
              >
                <div className="h-full relative flex">
                  <SceneHierarchy />
                  <PanelCollapseRail
                    side="left"
                    isOpen={uiPanels.leftOpen}
                    onToggle={handleLeftToggle}
                  />
                </div>
              </Panel>

              <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

              <Panel defaultSize="57%" minSize="30%">
                <Viewport />
              </Panel>

              <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

              <Panel
                panelRef={rightPanelRef}
                defaultSize="25%"
                minSize="220px"
                maxSize="35%"
                collapsible
                collapsedSize="0px"
              >
                <div className="h-full relative flex">
                  <PanelCollapseRail
                    side="right"
                    isOpen={uiPanels.rightOpen}
                    onToggle={handleRightToggle}
                  />
                  <Inspector />
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors cursor-row-resize" />

          <Panel
            panelRef={bottomPanelRef}
            defaultSize="30%"
            minSize="150px"
            maxSize="50%"
            collapsible
            collapsedSize="40px"
          >
            <ProjectBrowser
              isCollapsed={!uiPanels.bottomOpen}
              onToggleCollapse={handleBottomToggle}
            />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  )
}
