import type * as THREE from 'three'

/** trackId → pose group (ROS display-frame child under ROS_TO_THREE parent) */
export const annotationObjectByTrackId = new Map<string, THREE.Object3D>()

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

export function resolveAnnotationTrackId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object
  while (current) {
    const id = current.userData.annotationTrackId
    if (typeof id === 'string') return id
    current = current.parent
  }
  return null
}

/** Walk up for hover tooltip fields stamped on mesh/group userData */
export function resolveAnnotationHoverLabel(object: THREE.Object3D): {
  label: string
  topic?: string
  source: 'scene-update' | 'editable'
} | null {
  let current: THREE.Object3D | null = object
  while (current) {
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
