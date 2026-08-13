import type { LucideIcon } from 'lucide-react'
import {
  Aperture,
  Box,
  Camera,
  Move3d,
  Radar,
  Radio,
  Route,
  Scan,
} from 'lucide-react'
import {
  isCameraImageTopic,
  isLaserScanTopic,
  isLidarPointCloudTopic,
} from '@/lib/foxglove/ros-serialization'
import { isCameraInfoTopic } from '@/lib/ros/resolve-camera-topics'

/** Topics 面板行图标：按消息类型区分 */
export function getTopicTypeIcon(
  topic: string,
  schemaName?: string,
): LucideIcon {
  if (isCameraInfoTopic(topic, schemaName)) return Aperture
  if (isCameraImageTopic(topic, schemaName)) return Camera
  if (isLaserScanTopic(topic, schemaName)) return Radar
  if (isLidarPointCloudTopic(topic, schemaName)) return Scan
  if (
    schemaName?.includes('TFMessage') ||
    schemaName?.includes('FrameTransform') ||
    topic === '/tf' ||
    topic.endsWith('/tf') ||
    topic.includes('/tf_static')
  ) {
    return Move3d
  }
  if (schemaName?.includes('Path') || /\/plan|\/path/i.test(topic)) return Route
  if (
    schemaName?.includes('OccupancyGrid') ||
    /costmap/i.test(topic)
  ) {
    return Box
  }
  return Radio
}
