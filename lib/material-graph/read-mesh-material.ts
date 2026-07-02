import * as THREE from 'three'
import { objectByNodeId } from '@/lib/scene/object-registry'

export interface MeshMaterialSummary {
  materialType: string
  meshCount: number
}

/** 读取 mesh 上已有材质类型（尚无法反编译为 Shader Graph） */
export function getMeshMaterialSummary(nodeId: string): MeshMaterialSummary | null {
  const obj = objectByNodeId.get(nodeId)
  if (!obj) return null

  let materialType: string | null = null
  let meshCount = 0

  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    meshCount++
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    for (const m of mats) {
      if (m && !materialType) materialType = m.type
    }
  })

  if (meshCount === 0) return null
  return { materialType: materialType ?? 'Unknown', meshCount }
}
