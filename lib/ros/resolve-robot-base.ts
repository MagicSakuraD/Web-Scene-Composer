import type { SceneNode } from '@/lib/scene/types'

/** ROS base / chassis 常见命名，按优先级匹配 gltf-prim */
const ROBOT_BASE_NAME_PATTERNS = [
  /^Nova_Carter_ROS$/i,
  /^chassis_link$/i,
  /^base_link$/i,
  /_ROS$/i,
  /chassis/i,
  /base_link/i,
]

/**
 * 在 asset-ref 的 gltf 子树里找机器人底盘根节点。
 * odom 应对应此节点（如 Nova_Carter_ROS），而不是外层 asset-ref 空 group。
 */
export function findRobotBaseNodeId(
  nodes: Record<string, SceneNode>,
  assetRootId: string,
): string | null {
  const gltfNodes = Object.values(nodes).filter(
    (n) => n.type === 'gltf-prim' && n.assetRootId === assetRootId,
  )

  for (const pattern of ROBOT_BASE_NAME_PATTERNS) {
    const hit = gltfNodes.find((n) => pattern.test(n.name))
    if (hit) return hit.id
  }

  return null
}

export function findSimulateTargetNodeId(nodes: Record<string, SceneNode>): string | null {
  const assetRef = Object.values(nodes).find((n) => n.type === 'asset-ref')
  if (!assetRef) return null

  const baseId = findRobotBaseNodeId(nodes, assetRef.id)
  return baseId ?? assetRef.id
}

export function getSimulateTargetLabel(
  nodes: Record<string, SceneNode>,
  targetId: string,
): string {
  const node = nodes[targetId]
  if (!node) return targetId
  if (node.type === 'gltf-prim') return node.name
  return node.name
}
