import * as THREE from 'three'
import { TF_WHEEL_CHILD_FRAMES } from '@/lib/ros/tf-config'

const TF_WHEEL_SET = new Set<string>(TF_WHEEL_CHILD_FRAMES)

export interface RosTransform {
  translation: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
}

export interface TfEdge {
  parentFrame: string
  childFrame: string
  transform: RosTransform
  updatedAt: number
}

export interface TfTreeNode {
  frame: string
  children: TfTreeNode[]
}

type Listener = () => void

function identityPose(): RosTransform {
  return {
    translation: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  }
}

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

function multiplyPose(a: RosTransform, b: RosTransform): RosTransform {
  const qa = new THREE.Quaternion(a.rotation.x, a.rotation.y, a.rotation.z, a.rotation.w)
  const qb = new THREE.Quaternion(b.rotation.x, b.rotation.y, b.rotation.z, b.rotation.w)
  const q = qa.clone().multiply(qb)
  const t = new THREE.Vector3(b.translation.x, b.translation.y, b.translation.z)
    .applyQuaternion(qa)
    .add(new THREE.Vector3(a.translation.x, a.translation.y, a.translation.z))
  return {
    translation: { x: t.x, y: t.y, z: t.z },
    rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
  }
}

function invertPose(p: RosTransform): RosTransform {
  const q = new THREE.Quaternion(
    p.rotation.x,
    p.rotation.y,
    p.rotation.z,
    p.rotation.w,
  ).invert()
  const t = new THREE.Vector3(p.translation.x, p.translation.y, p.translation.z)
    .negate()
    .applyQuaternion(q)
  return {
    translation: { x: t.x, y: t.y, z: t.z },
    rotation: { x: q.x, y: q.y, z: q.z, w: q.w },
  }
}

/**
 * 最新 TF 边（child → parent + transform）。
 * 回放 NuScenes 等需保留任意 frame（map / LIDAR_TOP / base_link）；
 * 轮子/雷达白名单仅用于 hasWheelData / hasLidarData。
 */
class TfRuntimeStore {
  active = false
  generation = 0
  private edges = new Map<string, TfEdge>()
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.generation++
    for (const l of this.listeners) l()
  }

  reset() {
    this.active = false
    this.edges.clear()
    this.notify()
  }

  /** Seek 重建：清空边但保持订阅者，再写入该时刻最新 TF */
  clearEdges() {
    if (this.edges.size === 0) return
    this.edges.clear()
    this.notify()
  }

  setActive(active: boolean) {
    this.active = active
    if (!active) {
      this.edges.clear()
      this.notify()
    }
  }

  updateTransforms(
    transforms: Array<{
      parentFrame: string
      childFrame: string
      transform: RosTransform
    }>,
  ) {
    if (transforms.length === 0) return
    const now = performance.now()
    let changed = false
    for (const t of transforms) {
      const child = normalizeFrameId(t.childFrame)
      const parent = normalizeFrameId(t.parentFrame)
      if (!child || !parent || child === parent) continue
      this.edges.set(child, {
        parentFrame: parent,
        childFrame: child,
        transform: t.transform,
        updatedAt: now,
      })
      changed = true
    }
    if (changed) {
      this.active = true
      this.notify()
    }
  }

  getEdge(childFrame: string): TfEdge | undefined {
    return this.edges.get(normalizeFrameId(childFrame))
  }

  /** 当前所有 TF 边（child → parent） */
  getEdges(): TfEdge[] {
    return Array.from(this.edges.values())
  }

  /** 出现过的全部 frame id（含仅作 parent 的根） */
  getFrameIds(): string[] {
    const ids = new Set<string>()
    for (const edge of this.edges.values()) {
      ids.add(edge.childFrame)
      ids.add(edge.parentFrame)
    }
    return Array.from(ids).sort((a, b) => a.localeCompare(b))
  }

  /** 构建森林：根为没有任何 child→parent 边指向的 frame */
  getFrameTree(): TfTreeNode[] {
    const childrenByParent = new Map<string, string[]>()
    const childSet = new Set<string>()
    for (const edge of this.edges.values()) {
      childSet.add(edge.childFrame)
      let list = childrenByParent.get(edge.parentFrame)
      if (!list) {
        list = []
        childrenByParent.set(edge.parentFrame, list)
      }
      list.push(edge.childFrame)
    }
    for (const list of childrenByParent.values()) {
      list.sort((a, b) => a.localeCompare(b))
    }
    const all = this.getFrameIds()
    const roots = all.filter((id) => !childSet.has(id)).sort((a, b) => a.localeCompare(b))
    const build = (frame: string): TfTreeNode => ({
      frame,
      children: (childrenByParent.get(frame) ?? []).map(build),
    })
    return roots.map(build)
  }

  hasWheelData(): boolean {
    for (const f of TF_WHEEL_SET) {
      if (this.edges.has(f)) return true
    }
    return false
  }

  hasLidarData(frameId: string): boolean {
    return this.edges.has(normalizeFrameId(frameId))
  }

  /**
   * 返回将 `source` 系点变换到 `target` 系的位姿（p_target = R·p_source + t）。
   * 沿 TF 树向上查找公共祖先；找不到则返回 null。
   */
  lookupTransform(targetFrame: string, sourceFrame: string): RosTransform | null {
    const target = normalizeFrameId(targetFrame)
    const source = normalizeFrameId(sourceFrame)
    if (!target || !source) return null
    if (target === source) return identityPose()

    const sourceToAncestor = this.poseToAncestor(source, target)
    if (sourceToAncestor) return sourceToAncestor

    const targetToSourceRoot = this.poseToAncestor(target, source)
    if (targetToSourceRoot) return invertPose(targetToSourceRoot)

    const sourceChain = this.chainUp(source)
    const targetChain = this.chainUp(target)
    const sourceSet = new Map(sourceChain.map((c, i) => [c.frame, i]))
    let common: string | null = null
    let targetIdx = -1
    for (let i = 0; i < targetChain.length; i++) {
      if (sourceSet.has(targetChain[i].frame)) {
        common = targetChain[i].frame
        targetIdx = i
        break
      }
    }
    if (!common) return null

    const sourceIdx = sourceSet.get(common)!
    let sourceToCommon = identityPose()
    for (let i = 0; i < sourceIdx; i++) {
      sourceToCommon = multiplyPose(sourceChain[i].edge!.transform, sourceToCommon)
    }
    let targetToCommon = identityPose()
    for (let i = 0; i < targetIdx; i++) {
      targetToCommon = multiplyPose(targetChain[i].edge!.transform, targetToCommon)
    }
    return multiplyPose(invertPose(targetToCommon), sourceToCommon)
  }

  /** 若 ancestor 在 child 的祖先链上，返回 ancestor_T_child */
  private poseToAncestor(child: string, ancestor: string): RosTransform | null {
    let T = identityPose()
    let frame = child
    const seen = new Set<string>()
    for (let hops = 0; hops < 32; hops++) {
      if (frame === ancestor) return T
      if (seen.has(frame)) return null
      seen.add(frame)
      const edge = this.edges.get(frame)
      if (!edge) return null
      T = multiplyPose(edge.transform, T)
      frame = edge.parentFrame
    }
    return null
  }

  private chainUp(frame: string): Array<{ frame: string; edge: TfEdge | null }> {
    const out: Array<{ frame: string; edge: TfEdge | null }> = []
    const seen = new Set<string>()
    let f = frame
    for (let hops = 0; hops < 32; hops++) {
      if (seen.has(f)) break
      seen.add(f)
      const edge = this.edges.get(f) ?? null
      out.push({ frame: f, edge })
      if (!edge) break
      f = edge.parentFrame
    }
    return out
  }
}

export const tfRuntimeStore = new TfRuntimeStore()
