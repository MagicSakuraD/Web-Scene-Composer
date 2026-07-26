import { protobufRegistry } from '@/lib/mcap/protobuf-registry'

/** One cube from foxglove.SceneUpdate / SceneEntity.cubes */
export interface DecodedSceneCube {
  entityId: string
  frameId: string
  /** ROS / map position */
  position: [number, number, number]
  /** Quaternion xyzw (Foxglove / protobuf order) */
  orientation: [number, number, number, number]
  size: [number, number, number]
  /** rgba 0–1 */
  color: [number, number, number, number]
  metadata?: Record<string, string>
}

/** Latest SceneUpdate for a topic — full replace of cubes (NuScenes style) */
export interface DecodedSceneUpdate {
  cubes: DecodedSceneCube[]
}

function protoField(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function parseMetadata(raw: unknown): Record<string, string> | undefined {
  const rows = asArray(raw)
  if (rows.length === 0) return undefined
  const out: Record<string, string> = {}
  for (const row of rows) {
    const r = asRecord(row)
    if (!r) continue
    const key = String(protoField(r, 'key') ?? '')
    const value = String(protoField(r, 'value') ?? '')
    if (key) out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function parseCube(
  entityId: string,
  frameId: string,
  metadata: Record<string, string> | undefined,
  cube: Record<string, unknown>,
  index: number,
): DecodedSceneCube {
  const pose = asRecord(protoField(cube, 'pose')) ?? {}
  const position = asRecord(protoField(pose, 'position')) ?? {}
  const orientation = asRecord(protoField(pose, 'orientation')) ?? {}
  const size = asRecord(protoField(cube, 'size')) ?? {}
  const color = asRecord(protoField(cube, 'color')) ?? {}

  return {
    entityId: index === 0 ? entityId : `${entityId}#${index}`,
    frameId,
    position: [num(position.x), num(position.y), num(position.z)],
    orientation: [
      num(orientation.x),
      num(orientation.y),
      num(orientation.z),
      num(orientation.w, 1),
    ],
    size: [num(size.x, 1), num(size.y, 1), num(size.z, 1)],
    color: [
      num(color.r, 1),
      num(color.g, 0.6),
      num(color.b, 0.2),
      num(color.a, 0.5),
    ],
    metadata,
  }
}

/**
 * Decode foxglove.SceneUpdate via MCAP-embedded protobuf descriptor.
 * Strategy: collect all cubes from entities (full replace per message).
 */
export function decodeFoxgloveSceneUpdate(
  schemaId: number,
  data: Uint8Array,
): DecodedSceneUpdate | null {
  const msg = protobufRegistry.decode(schemaId, data)
  if (!msg) return null

  const obj = protobufRegistry.toObject(schemaId, msg)
  const entities = asArray(protoField(obj, 'entities'))
  const cubes: DecodedSceneCube[] = []

  for (const entityRaw of entities) {
    const entity = asRecord(entityRaw)
    if (!entity) continue
    const entityId = String(protoField(entity, 'id') ?? 'entity')
    const frameId = String(protoField(entity, 'frameId', 'frame_id') ?? '')
    const metadata = parseMetadata(protoField(entity, 'metadata'))
    const cubeList = asArray(protoField(entity, 'cubes'))
    cubeList.forEach((c, i) => {
      const cube = asRecord(c)
      if (!cube) return
      cubes.push(parseCube(entityId, frameId, metadata, cube, i))
    })
  }

  return { cubes }
}

export function isSceneUpdateSchema(schemaName: string): boolean {
  return schemaName.includes('SceneUpdate')
}

export function isSceneUpdateTopic(topic: string, schemaName?: string): boolean {
  if (schemaName && isSceneUpdateSchema(schemaName)) return true
  return topic.includes('/markers/annotations') || topic.endsWith('/annotations')
}
