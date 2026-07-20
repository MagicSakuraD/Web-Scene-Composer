'use client'

import dynamic from 'next/dynamic'
import { useAtomValue, useSetAtom } from 'jotai'
import { ViewportToolbar } from '@/components/viewport-toolbar'
import { openCreateContextMenu } from '@/components/create-context-menu'
import { contextMenuAtom } from '@/lib/scene/atoms'
import { appModeAtom } from '@/lib/playback/atoms'

const SceneCanvas = dynamic(
  () => import('@/components/viewport/scene-canvas').then((m) => m.SceneCanvas),
  { ssr: false },
)

export function Viewport() {
  const setContextMenu = useSetAtom(contextMenuAtom)
  const appMode = useAtomValue(appModeAtom)

  return (
    <div className="h-full flex flex-col bg-viewport relative">
      <div
        className="flex-1 relative overflow-hidden"
        onContextMenu={(e) => {
          // 回放模式右键用于平移，不弹出创建菜单
          if (appMode === 'playback') {
            e.preventDefault()
            return
          }
          openCreateContextMenu(e, 'viewport', setContextMenu)
        }}
      >
        <SceneCanvas />
        <ViewportToolbar />
      </div>
    </div>
  )
}
