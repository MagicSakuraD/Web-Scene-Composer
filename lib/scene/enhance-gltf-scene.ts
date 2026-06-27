import * as THREE from 'three'

const FLOOR_NAME = /floor|ground|plane|slab|地面|地板/i

/** 仅 albedo / emissive 贴图用 sRGB；roughness/normal 等保持线性 */
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

/**
 * glTF 导入后增强：阴影、PBR 贴图色彩空间、修正 Blender 导出常见问题。
 */
export function enhanceGltfScene(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return

    obj.castShadow = true
    obj.receiveShadow = true

    const isFloorLike = FLOOR_NAME.test(obj.name)

    const applyMaterial = (raw: THREE.Material) => {
      if (raw instanceof THREE.MeshBasicMaterial && (isFloorLike || raw.map)) {
        const upgraded = upgradeBasicMaterial(raw)
        setColorMapColorSpace(upgraded.map)
        if (isFloorLike) {
          upgraded.roughness = 0.92
          upgraded.metalness = 0.02
        }
        return upgraded
      }

      if (raw instanceof THREE.MeshStandardMaterial || raw instanceof THREE.MeshPhysicalMaterial) {
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
      }

      return raw
    }

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(applyMaterial)
    } else if (obj.material) {
      obj.material = applyMaterial(obj.material)
    }
  })
}
