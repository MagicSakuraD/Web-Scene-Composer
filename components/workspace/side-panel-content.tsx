'use client'

import type { ReactNode } from 'react'
import type { SidePanelType } from '@/lib/workspace/types'
import { SceneHierarchy } from '@/components/scene-hierarchy'
import { Inspector } from '@/components/inspector'
import { TopicTree } from '@/components/playback/topic-tree'
import { TransformsPanel } from '@/components/playback/transforms-panel'
import { FrameInspector } from '@/components/playback/frame-inspector'

export function SidePanelContent({ type }: { type: SidePanelType }): ReactNode {
  switch (type) {
    case 'hierarchy':
      return <SceneHierarchy />
    case 'topics':
      return <TopicTree />
    case 'transforms':
      return <TransformsPanel />
    case 'inspector':
      return <Inspector />
    case 'frame-inspector':
      return <FrameInspector />
    default:
      return null
  }
}
