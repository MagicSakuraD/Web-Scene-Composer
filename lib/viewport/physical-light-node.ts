import type { SceneNode } from '@/lib/scene/types'
import { PHYSICAL_LIGHTS_CONFIG } from '@/lib/viewport/visual-config'

/** Sun 按钮平行光在场景树中的固定节点 id */
export const VIEWPORT_PHYSICAL_LIGHT_ID = 'viewport-physical-light'

export function buildViewportPhysicalLightNode(
  existing?: SceneNode | null,
): SceneNode {
  const { distantLight } = PHYSICAL_LIGHTS_CONFIG
  const position = existing?.transform.position ?? [...distantLight.position]

  return {
    id: VIEWPORT_PHYSICAL_LIGHT_ID,
    name: existing?.name ?? 'Sun Light',
    type: 'physical-distant-light',
    parentId: 'root',
    transform: {
      position: position as [number, number, number],
      rotation: existing?.transform.rotation ?? [0, 0, 0],
      scale: existing?.transform.scale ?? [1, 1, 1],
    },
    lightColor: existing?.lightColor ?? distantLight.color,
    lightIntensity: existing?.lightIntensity ?? distantLight.intensity,
    lightTarget: existing?.lightTarget ?? [...distantLight.target],
  }
}

export function isViewportPhysicalLightNode(nodeId: string) {
  return nodeId === VIEWPORT_PHYSICAL_LIGHT_ID
}
