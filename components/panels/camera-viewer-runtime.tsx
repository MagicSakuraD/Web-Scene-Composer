'use client'

import { useAtomValue } from 'jotai'
import { cameraViewerTopicsAtom } from '@/lib/ros/atoms'
import { useCameraViewer } from '@/hooks/use-camera-viewer'

/** Topics 眼睛 → cameraViewerTopicsAtom → 订阅；与底部 Tab 是否打开无关 */
export function CameraViewerRuntime() {
  const topics = useAtomValue(cameraViewerTopicsAtom)
  useCameraViewer(topics, true)
  return null
}
