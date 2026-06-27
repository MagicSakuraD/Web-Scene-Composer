'use client'

import { useLidarViewer } from '@/hooks/use-lidar-viewer'

/** Tab 存在即订阅（切换 Tab 不中断），关闭 Tab 才卸载 */
export function LidarRuntime() {
  useLidarViewer(true)
  return null
}
