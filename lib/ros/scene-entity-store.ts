import type { DecodedSceneCube, DecodedSceneUpdate } from '@/lib/mcap/foxglove-scene-update-decode'

type Listener = () => void

export interface SceneEntitySnapshot {
  /** Flattened cubes across all visible topics */
  cubes: DecodedSceneCube[]
  generation: number
  topicCount: number
}

const EMPTY: SceneEntitySnapshot = {
  cubes: [],
  generation: 0,
  topicCount: 0,
}

/**
 * Readonly SceneUpdate cubes for viewport (per-topic full replace).
 */
class SceneEntityStore {
  private listeners = new Set<Listener>()
  private byTopic = new Map<string, DecodedSceneCube[]>()
  private snapshot: SceneEntitySnapshot = { ...EMPTY, cubes: [] }
  generation = 0

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot(): SceneEntitySnapshot {
    return this.snapshot
  }

  private rebuild() {
    const cubes: DecodedSceneCube[] = []
    for (const list of this.byTopic.values()) {
      cubes.push(...list)
    }
    this.generation += 1
    this.snapshot = {
      cubes,
      generation: this.generation,
      topicCount: this.byTopic.size,
    }
    for (const listener of this.listeners) listener()
  }

  /** Replace all cubes for a topic (NuScenes full-frame SceneUpdate) */
  setTopicUpdate(topic: string, update: DecodedSceneUpdate) {
    this.byTopic.set(topic, update.cubes)
    this.rebuild()
  }

  clearTopic(topic: string) {
    if (!this.byTopic.has(topic)) return
    this.byTopic.delete(topic)
    this.rebuild()
  }

  clearAll() {
    if (this.byTopic.size === 0 && this.snapshot.cubes.length === 0) return
    this.byTopic.clear()
    this.generation += 1
    this.snapshot = { cubes: [], generation: this.generation, topicCount: 0 }
    for (const listener of this.listeners) listener()
  }
}

export const sceneEntityStore = new SceneEntityStore()
