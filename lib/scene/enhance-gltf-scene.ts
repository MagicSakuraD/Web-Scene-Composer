import * as THREE from 'three'
import { instanceIdenticalMeshes } from '@/lib/scene/instance-identical-meshes'

const FLOOR_NAME = /floor|ground|plane|slab|地面|地板/i
/** 机器人等需要脚底投影的动态物体（其余仓库 props 一律不投阴影） */
const DYNAMIC_CASTER_NAME = /nova_carter|wheel_|caster_|robot|skinned/i

/** glTF 导入性能相关开关 */
export const GLTF_IMPORT_PERF = {
  /** 相同 geometry+material 网格数 ≥ 此值 → InstancedMesh */
  autoInstanceMinCount: 6,
  /** true：导入后自动实例化（仓库纸箱/货架收益大） */
  autoInstance: true,
  /**
   * 静态导入 mesh 默认不 castShadow。
   * 海量道具投阴影 × parallel light shadow map = WebGPU Device Lost 主因之一。
   */
  staticCastShadow: false,
  /** 仅地板类收阴影（若平行光不开阴影则几乎无开销） */
  floorReceiveShadow: true,
  /** InstancedMesh 禁止投阴影（实例阴影在 WebGPU 上极贵且易崩） */
  instancedCastShadow: false,
} as const

function setColorMapColorSpace(tex: THREE.Texture | null | undefined) {
  if (tex) tex.colorSpace = THREE.SRGBColorSpace
}

function setLinearMapColorSpace(tex: THREE.Texture | null | undefined) {
  if (tex) tex.colorSpace = THREE.NoColorSpace
}

function upgradeBasicMaterial(basic: THREE.MeshBasicMaterial): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: basic.map,
    color: basic.color,
    transparent: basic.transparent,
    opacity: basic.opacity,
    side: basic.side,
    roughness: 0.82,
    metalness: 0.04,
  })
}

function applyShadowPolicy(mesh: THREE.Mesh, isFloorLike: boolean) {
  if (isFloorLike) {
    mesh.castShadow = false
    mesh.receiveShadow = GLTF_IMPORT_PERF.floorReceiveShadow
    return
  }

  // 动态体（机器人/蒙皮）才投阴影；仓库纸箱货架全部关掉
  const allowCast =
    GLTF_IMPORT_PERF.staticCastShadow ||
    mesh instanceof THREE.SkinnedMesh ||
    DYNAMIC_CASTER_NAME.test(mesh.name)

  mesh.castShadow = allowCast
  mesh.receiveShadow = false
}

/**
 * glTF 导入后增强：阴影策略、PBR 色彩空间、相同网格自动实例化。
 * 升级后的材质按源 uuid 复用，避免拆散 InstancedMesh 分组。
 */
export function enhanceGltfScene(root: THREE.Object3D): void {
  const materialCache = new Map<string, THREE.Material>()

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    if (obj.userData.isSelectionOutline) return

    const isFloorLike = FLOOR_NAME.test(obj.name)
    applyShadowPolicy(obj, isFloorLike)

    const applyMaterial = (raw: THREE.Material) => {
      const cached = materialCache.get(raw.uuid)
      if (cached) return cached

      let next: THREE.Material = raw

      if (raw instanceof THREE.MeshBasicMaterial && (isFloorLike || raw.map)) {
        const upgraded = upgradeBasicMaterial(raw)
        setColorMapColorSpace(upgraded.map)
        if (isFloorLike) {
          upgraded.roughness = 0.92
          upgraded.metalness = 0.02
        }
        next = upgraded
      } else if (
        raw instanceof THREE.MeshStandardMaterial ||
        raw instanceof THREE.MeshPhysicalMaterial
      ) {
        setColorMapColorSpace(raw.map)
        setColorMapColorSpace(raw.emissiveMap)
        setLinearMapColorSpace(raw.normalMap)
        setLinearMapColorSpace(raw.roughnessMap)
        setLinearMapColorSpace(raw.metalnessMap)
        setLinearMapColorSpace(raw.aoMap)
        setLinearMapColorSpace(raw.bumpMap)

        if (isFloorLike) {
          raw.roughness = Math.max(raw.roughness, 0.88)
          raw.metalness = Math.min(raw.metalness, 0.08)
        } else {
          raw.envMapIntensity = 1
        }

        if (raw.emissiveIntensity > 0.05 && !isFloorLike) {
          raw.emissiveIntensity = Math.min(raw.emissiveIntensity, 0.25)
        }
        next = raw
      }

      materialCache.set(raw.uuid, next)
      return next
    }

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(applyMaterial)
    } else if (obj.material) {
      obj.material = applyMaterial(obj.material)
    }
  })

  if (GLTF_IMPORT_PERF.autoInstance) {
    const buckets = instanceIdenticalMeshes(root, {
      minCount: GLTF_IMPORT_PERF.autoInstanceMinCount,
    })

    if (!GLTF_IMPORT_PERF.instancedCastShadow) {
      for (const { mesh } of buckets) {
        mesh.castShadow = false
        mesh.receiveShadow = false
      }
    }

    if (process.env.NODE_ENV === 'development' && buckets.length > 0) {
      const total = buckets.reduce((n, b) => n + b.proxies.length, 0)
      console.info('[GLTF] auto-instance', {
        buckets: buckets.length,
        meshes: total,
        drawCallsSavedApprox: total - buckets.length,
      })
    }
  }
}
