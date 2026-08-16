import type * as THREE from 'three'

/** trackId → pose group (ROS display-frame child under ROS_TO_THREE parent) */
export const annotationObjectByTrackId = new Map<string, THREE.Object3D>()

/** Readonly SceneUpdate InstancedMesh (hover via instanceId) */
let sceneAnnotationPickRoot: THREE.Object3D | null = null

type Listener = () => void
const listeners = new Set<Listener>()
let generation = 0

function notify() {
  generation += 1
  for (const l of listeners) l()
}

export function subscribeAnnotationRegistry(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAnnotationRegistryGeneration(): number {
  return generation
}

export function registerAnnotationObject(trackId: string, obj: THREE.Object3D) {
  annotationObjectByTrackId.set(trackId, obj)
  notify()
}

export function unregisterAnnotationObject(trackId: string) {
  if (!annotationObjectByTrackId.delete(trackId)) return
  notify()
}

export function setSceneAnnotationPickRoot(obj: THREE.Object3D | null) {
  sceneAnnotationPickRoot = obj
}

/** Hover/pick targets only — skip warehouse meshes and 100k LiDAR points. */
export function collectAnnotationPickables(): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  if (sceneAnnotationPickRoot) out.push(sceneAnnotationPickRoot)
  for (const obj of annotationObjectByTrackId.values()) out.push(obj)
  return out
}

export function resolveAnnotationTrackId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const id = current.userData.annotationTrackId
    if (typeof id === 'string') return id
    current = current.parent
  }
  return null
}

export interface AnnotationHoverLabel {
  label: string
  topic?: string
  source: 'scene-update' | 'editable'
}

/** Walk up for hover tooltip; InstancedMesh uses instanceId → labels[]. */
export function resolveAnnotationHoverLabel(
  object: THREE.Object3D,
  instanceId?: number,
): AnnotationHoverLabel | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const labels = current.userData.annotationInstanceLabels
    if (Array.isArray(labels) && instanceId != null) {
      const label = labels[instanceId]
      if (typeof label === 'string' && label.length > 0) {
        const topic =
          typeof current.userData.annotationTopic === 'string'
            ? current.userData.annotationTopic
            : undefined
        return { label, topic, source: 'scene-update' }
      }
    }
    const label = current.userData.annotationLabel
    if (typeof label === 'string' && label.length > 0) {
      const topic =
        typeof current.userData.annotationTopic === 'string'
          ? current.userData.annotationTopic
          : undefined
      const source =
        current.userData.annotationSource === 'editable' ? 'editable' : 'scene-update'
      return { label, topic, source }
    }
    current = current.parent
  }
  return null
}
