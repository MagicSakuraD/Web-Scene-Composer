import * as THREE from 'three'

export interface InstanceIdenticalOptions {
  /** 共享相同 geometry+material 的网格数 ≥ 此值才实例化；默认 6 */
  minCount?: number
  /** 跳过带蒙皮 / 形变的网格 */
  skipSkinned?: boolean
}

export interface InstancedMeshBucket {
  mesh: THREE.InstancedMesh
  /** 与 instance 下标一一对应的空 Object3D（保留层级与 Gizmo） */
  proxies: THREE.Object3D[]
}

const _world = new THREE.Matrix4()
const _invParent = new THREE.Matrix4()
const _local = new THREE.Matrix4()

function materialKey(mat: THREE.Material | THREE.Material[]): string {
  if (Array.isArray(mat)) return mat.map((m) => m.uuid).join(',')
  return mat.uuid
}

function meshKey(mesh: THREE.Mesh): string {
  return `${mesh.geometry.uuid}|${materialKey(mesh.material)}`
}

/**
 * 把空 Object3D 的世界矩阵写入 InstancedMesh 某一槽位（相对 InstancedMesh 父节点）。
 */
export function writeProxyToInstance(
  instanced: THREE.InstancedMesh,
  index: number,
  proxy: THREE.Object3D,
) {
  proxy.updateMatrixWorld(true)
  _world.copy(proxy.matrixWorld)
  const parent = instanced.parent
  if (parent) {
    parent.updateMatrixWorld(true)
    _invParent.copy(parent.matrixWorld).invert()
    _local.multiplyMatrices(_invParent, _world)
  } else {
    _local.copy(_world)
  }
  instanced.setMatrixAt(index, _local)
}

/**
 * 将共享 geometry+material 的 Mesh 合并为 InstancedMesh，显著降低 Draw Call。
 * 原 Mesh 降级为空 Object3D（proxy），保留层级 / 选中 / Transform；每帧或脏时同步矩阵。
 *
 * 比离线 `gltfjsx --instance` 更适合本编辑器的动态导入通路；仓库静态道具收益最大。
 */
export function instanceIdenticalMeshes(
  root: THREE.Object3D,
  options: InstanceIdenticalOptions = {},
): InstancedMeshBucket[] {
  const minCount = options.minCount ?? 6
  const skipSkinned = options.skipSkinned !== false

  const groups = new Map<string, THREE.Mesh[]>()

  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    if (skipSkinned && obj instanceof THREE.SkinnedMesh) return
    if (!obj.geometry || !obj.material) return
    if (obj.userData.skipAutoInstance) return
    // 已是实例 / 选中轮廓等内部物体
    if (obj instanceof THREE.InstancedMesh) return
    if (obj.userData.isSelectionOutline) return

    const key = meshKey(obj)
    const list = groups.get(key)
    if (list) list.push(obj)
    else groups.set(key, [obj])
  })

  const buckets: InstancedMeshBucket[] = []
  const holder = new THREE.Group()
  holder.name = '__auto_instanced__'
  holder.userData.ignorePick = false
  root.add(holder)

  for (const meshes of groups.values()) {
    if (meshes.length < minCount) continue

    const proto = meshes[0]
    const geom = proto.geometry
    const mat = Array.isArray(proto.material) ? proto.material[0] : proto.material
    const instanced = new THREE.InstancedMesh(geom, mat, meshes.length)
    instanced.name = `${proto.name || 'mesh'}_instances`
    instanced.castShadow = proto.castShadow
    instanced.receiveShadow = proto.receiveShadow
    instanced.frustumCulled = true
    instanced.userData.isAutoInstanced = true

    const proxies: THREE.Object3D[] = []
    const instanceSceneNodeIds: (string | undefined)[] = []

    for (let i = 0; i < meshes.length; i++) {
      const mesh = meshes[i]
      const parent = mesh.parent
      if (!parent) continue

      const proxy = new THREE.Object3D()
      proxy.name = mesh.name
      proxy.position.copy(mesh.position)
      proxy.quaternion.copy(mesh.quaternion)
      proxy.scale.copy(mesh.scale)
      proxy.userData = {
        ...mesh.userData,
        demotedFromMesh: true,
        autoInstanceIndex: i,
      }

      while (mesh.children.length > 0) {
        proxy.add(mesh.children[0])
      }

      parent.add(proxy)
      parent.remove(mesh)

      proxies.push(proxy)
      instanceSceneNodeIds.push(
        typeof proxy.userData.sceneNodeId === 'string'
          ? proxy.userData.sceneNodeId
          : undefined,
      )
      proxy.userData.autoInstancedMesh = instanced
    }

    instanced.userData.instanceSceneNodeIds = instanceSceneNodeIds
    instanced.userData.instanceProxies = proxies
    holder.add(instanced)

    for (let i = 0; i < proxies.length; i++) {
      writeProxyToInstance(instanced, i, proxies[i])
    }
    instanced.instanceMatrix.needsUpdate = true
    buckets.push({ mesh: instanced, proxies })
  }

  if (buckets.length === 0) {
    root.remove(holder)
  } else {
    root.userData.autoInstancedBuckets = buckets
  }

  return buckets
}

/** 将 proxy 变换同步回 InstancedMesh（Gizmo 拖完后或每帧调用） */
export function syncAutoInstancedMeshes(root: THREE.Object3D) {
  const buckets = root.userData.autoInstancedBuckets as InstancedMeshBucket[] | undefined
  if (!buckets?.length) return

  for (const { mesh, proxies } of buckets) {
    let dirty = false
    for (let i = 0; i < proxies.length; i++) {
      const proxy = proxies[i]
      if (!proxy.parent) continue
      writeProxyToInstance(mesh, i, proxy)
      dirty = true
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
  }
}
