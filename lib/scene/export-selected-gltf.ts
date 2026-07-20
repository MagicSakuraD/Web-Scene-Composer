import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { objectByNodeId } from '@/lib/scene/object-registry'

export type SelectionGltfExportErrorCode = 'noSelection' | 'noObject' | 'exportFailed'

export class SelectionGltfExportError extends Error {
  constructor(
    public readonly code: SelectionGltfExportErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'SelectionGltfExportError'
  }
}

function isNodeLikeMaterial(mat: THREE.Material): boolean {
  // Mesh*NodeMaterial 等 TSL 材质：GLTFExporter 无法可靠序列化
  return (
    'isNodeMaterial' in mat ||
    mat.type.includes('NodeMaterial') ||
    /NodeMaterial$/i.test(mat.type)
  )
}

function toExportMaterial(mat: THREE.Material): THREE.Material {
  if (isNodeLikeMaterial(mat)) {
    return new THREE.MeshStandardMaterial({
      color: 0xb0b0b0,
      roughness: 0.85,
      metalness: 0.05,
      name: mat.name || 'Default',
    })
  }
  if (
    mat instanceof THREE.MeshStandardMaterial ||
    mat instanceof THREE.MeshPhysicalMaterial ||
    mat instanceof THREE.MeshBasicMaterial ||
    mat instanceof THREE.MeshPhongMaterial
  ) {
    return mat.clone()
  }
  return new THREE.MeshStandardMaterial({
    color: 0xb0b0b0,
    roughness: 0.85,
    metalness: 0.05,
    name: mat.name || 'Default',
  })
}

/** 去掉选中轮廓 / 辅助物，并把不可导材质换成 Standard */
function sanitizeCloneForExport(root: THREE.Object3D) {
  const removeList: THREE.Object3D[] = []

  root.traverse((obj) => {
    if (
      obj.userData?.isSelectionBox ||
      obj.userData?.isSelectionOutline ||
      obj.name === '__wsc_selection_bbox__' ||
      obj.name === '__wsc_selection_outline__' ||
      obj instanceof THREE.Light ||
      obj instanceof THREE.Camera ||
      obj instanceof THREE.GridHelper ||
      obj instanceof THREE.AxesHelper
    ) {
      removeList.push(obj)
      return
    }

    if (obj instanceof THREE.Mesh || obj instanceof THREE.SkinnedMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      const next = mats.map((m) => toExportMaterial(m))
      obj.material = next.length === 1 ? next[0]! : next
    }
  })

  for (const obj of removeList) {
    obj.parent?.remove(obj)
  }
}

function downloadBlob(data: ArrayBuffer | object, filename: string) {
  const blob =
    data instanceof ArrayBuffer
      ? new Blob([data], { type: 'model/gltf-binary' })
      : new Blob([JSON.stringify(data, null, 2)], { type: 'model/gltf+json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 导出场景中当前选中物体及其 Three.js 子树为 .glb。
 * 使用世界变换作为根，便于单独打开时位置与视口一致。
 * 材质：保留常规 Standard/Physical；NodeMaterial 等降级为灰色 Standard。
 */
export async function downloadSelectedObjectGltf(
  nodeId: string | null | undefined,
  displayName?: string,
) {
  if (!nodeId || nodeId === 'root') {
    throw new SelectionGltfExportError('noSelection')
  }

  const source = objectByNodeId.get(nodeId)
  if (!source) {
    throw new SelectionGltfExportError('noObject')
  }

  source.updateWorldMatrix(true, true)
  const clone = source.clone(true)

  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  source.matrixWorld.decompose(pos, quat, scl)
  clone.position.copy(pos)
  clone.quaternion.copy(quat)
  clone.scale.copy(scl)
  clone.name = displayName || source.name || nodeId

  sanitizeCloneForExport(clone)

  try {
    const exporter = new GLTFExporter()
    const result = await exporter.parseAsync(clone, {
      binary: true,
      onlyVisible: false,
    })

    const safeName = (displayName || clone.name || 'selection').replace(/[^\w.-]+/g, '_')
    downloadBlob(result as ArrayBuffer, `${safeName}.glb`)
  } catch (err) {
    console.error('[export-selected-gltf]', err)
    throw new SelectionGltfExportError('exportFailed')
  }
}
