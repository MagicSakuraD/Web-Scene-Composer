import type {
  DecodedCameraFrame,
  DecodedPointCloud,
  DecodedTfTransform,
} from '@/lib/foxglove/ros-serialization'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'

const FLOAT32_FIELD = 7

interface ProtoTimestamp {
  seconds?: number
  nanos?: number
}

interface ProtoField {
  name?: string
  offset?: number
  type?: number
}

function protoField(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

function protoTimestamp(ts: unknown): { sec: number; nanosec: number } {
  const t = ts as ProtoTimestamp | undefined
  return {
    sec: typeof t?.seconds === 'number' ? t.seconds : 0,
    nanosec: typeof t?.nanos === 'number' ? t.nanos : 0,
  }
}

function asBytes(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  return new Uint8Array()
}

export function decodeFoxglovePointCloud(
  schemaId: number,
  data: Uint8Array,
): DecodedPointCloud | null {
  const msg = protobufRegistry.decode(schemaId, data)
  if (!msg) return null

  const obj = protobufRegistry.toObject(schemaId, msg)
  const pointStride = Number(protoField(obj, 'pointStride', 'point_stride') ?? 0)
  const bytes = asBytes(protoField(obj, 'data'))
  const fields = (protoField(obj, 'fields') as ProtoField[] | undefined) ?? []

  if (pointStride <= 0 || bytes.length < pointStride) return null

  const pointCount = Math.floor(bytes.length / pointStride)
  if (pointCount <= 0) return null

  let fx = 0
  let fy = 4
  let fz = 8
  for (const f of fields) {
    if (f.name === 'x' && f.type === FLOAT32_FIELD) fx = f.offset ?? 0
    if (f.name === 'y' && f.type === FLOAT32_FIELD) fy = f.offset ?? 4
    if (f.name === 'z' && f.type === FLOAT32_FIELD) fz = f.offset ?? 8
  }

  const positions = new Float32Array(pointCount * 3)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  for (let i = 0; i < pointCount; i++) {
    const base = i * pointStride
    positions[i * 3] = view.getFloat32(base + fx, true)
    positions[i * 3 + 1] = view.getFloat32(base + fy, true)
    positions[i * 3 + 2] = view.getFloat32(base + fz, true)
  }

  const { sec, nanosec } = protoTimestamp(protoField(obj, 'timestamp'))
  return {
    pointCount,
    pointStep: pointStride,
    frameId: String(protoField(obj, 'frameId', 'frame_id') ?? ''),
    stampSec: sec,
    stampNanosec: nanosec,
    positions,
  }
}

export async function decodeFoxgloveCompressedImage(
  schemaId: number,
  data: Uint8Array,
): Promise<DecodedCameraFrame | null> {
  const msg = protobufRegistry.decode(schemaId, data)
  if (!msg) return null

  const obj = protobufRegistry.toObject(schemaId, msg)
  const imageBytes = asBytes(protoField(obj, 'data'))
  if (imageBytes.length === 0) return null

  const format = String(protoField(obj, 'format') ?? 'jpeg').toLowerCase()
  const mime = format.includes('png')
    ? 'image/png'
    : format.includes('webp')
      ? 'image/webp'
      : 'image/jpeg'

  try {
    const blob = new Blob([imageBytes as BlobPart], { type: mime })
    const bitmap = await createImageBitmap(blob)
    const { sec, nanosec } = protoTimestamp(protoField(obj, 'timestamp'))
    return {
      width: bitmap.width,
      height: bitmap.height,
      encoding: format,
      stampSec: sec,
      stampNanosec: nanosec,
      frameId: String(protoField(obj, 'frameId', 'frame_id') ?? ''),
      bitmap,
    }
  } catch {
    return null
  }
}

export function decodeFoxgloveFrameTransform(
  schemaId: number,
  data: Uint8Array,
): DecodedTfTransform[] | null {
  const msg = protobufRegistry.decode(schemaId, data)
  if (!msg) return null

  const obj = protobufRegistry.toObject(schemaId, msg)
  const translation = protoField(obj, 'translation') as
    | { x?: number; y?: number; z?: number }
    | undefined
  const rotation = protoField(obj, 'rotation') as
    | { x?: number; y?: number; z?: number; w?: number }
    | undefined

  if (!translation || !rotation) return null

  return [
    {
      parentFrame: String(protoField(obj, 'parentFrameId', 'parent_frame_id') ?? ''),
      childFrame: String(protoField(obj, 'childFrameId', 'child_frame_id') ?? ''),
      transform: {
        translation: {
          x: translation.x ?? 0,
          y: translation.y ?? 0,
          z: translation.z ?? 0,
        },
        rotation: {
          x: rotation.x ?? 0,
          y: rotation.y ?? 0,
          z: rotation.z ?? 0,
          w: rotation.w ?? 1,
        },
      },
    },
  ]
}

export function isFoxgloveProtobufSchema(schemaName: string): boolean {
  return schemaName.startsWith('foxglove.')
}
