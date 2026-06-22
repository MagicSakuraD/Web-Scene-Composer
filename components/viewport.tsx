'use client'

import dynamic from 'next/dynamic'
import { useSetAtom } from 'jotai'
import { ViewportToolbar } from '@/components/viewport-toolbar'
import { openCreateContextMenu } from '@/components/create-context-menu'
import { contextMenuAtom } from '@/lib/scene/atoms'

const SceneCanvas = dynamic(
  () => import('@/components/viewport/scene-canvas').then((m) => m.SceneCanvas),
  { ssr: false },
)

export function Viewport() {
  const setContextMenu = useSetAtom(contextMenuAtom)

  return (
    <div className="h-full flex flex-col bg-viewport relative">
      <div
        className="flex-1 relative overflow-hidden"
        onContextMenu={(e) => openCreateContextMenu(e, 'viewport', setContextMenu)}
      >
        <SceneCanvas />
        <ViewportToolbar />
      </div>
    </div>
  )
}
