'use client'

import { useLidarViewer } from '@/hooks/use-lidar-viewer'

/** 由 Topics 眼睛 / lidarDisplayAtom 驱动订阅；与底栏 Tab 无关 */
export function LidarRuntime() {
  useLidarViewer(true)
  return null
}
