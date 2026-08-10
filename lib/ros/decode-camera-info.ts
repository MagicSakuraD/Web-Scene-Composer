import { MessageReader } from '@foxglove/rosmsg2-serialization'
import { ros2humble, ros2jazzy } from '@foxglove/rosmsg-msgs-common'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'
import type { DecodedCameraInfo } from '@/lib/ros/camera-info-store'

const ros2msgs = ros2jazzy ?? ros2humble

function toFloat64Array(raw: unknown, expectedLen?: number): Float64Array {
  if (raw instanceof Float64Array) {
    return expectedLen != null ? raw.subarray(0, expectedLen) : raw
  }
  if (raw instanceof Float32Array) return Float64Array.from(raw)
  if (Array.isArray(raw)) return Float64Array.from(raw as number[])
  return new Float64Array(expectedLen ?? 0)
}

const cameraInfoDefs = [
  ros2msgs['sensor_msgs/CameraInfo'] ?? ros2humble['sensor_msgs/CameraInfo'],
  ros2msgs['std_msgs/Header'] ?? ros2humble['std_msgs/Header'],
  ros2msgs['builtin_interfaces/Time'] ?? ros2humble['builtin_interfaces/Time'],
  ros2msgs['sensor_msgs/RegionOfInterest'] ?? ros2humble['sensor_msgs/RegionOfInterest'],
].filter((d): d is NonNullable<typeof d> => d != null)

const cameraInfoReader =
  cameraInfoDefs.length >= 1 ? new MessageReader(cameraInfoDefs) : null

/** sensor_msgs/msg/CameraInfo — https://github.com/ros2/common_interfaces/blob/master/sensor_msgs/msg/CameraInfo.msg */
export function decodeRosCameraInfo(
  topic: string,
  data: Uint8Array,
): DecodedCameraInfo | null {
  if (!cameraInfoReader) return null
  try {
    const msg = cameraInfoReader.readMessage<{
      header: { frame_id: string }
      height: number
      width: number
      distortion_model: string
      d: number[] | Float64Array
      k: number[] | Float64Array
    }>(data)
    const width = Number(msg.width ?? 0)
    const height = Number(msg.height ?? 0)
    const K = toFloat64Array(msg.k, 9)
    if (!width || !height || K.length < 9 || !(K[0] > 0)) return null
    return {
      topic,
      frameId: msg.header?.frame_id ?? '',
      width,
      height,
      K,
      D: toFloat64Array(msg.d),
      distortionModel: msg.distortion_model ?? '',
    }
  } catch {
    return null
  }
}

function protoField(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

/** foxglove.CameraCalibration (protobuf, common in NuScenes MCAP) */
export function decodeFoxgloveCameraCalibration(
  topic: string,
  schemaId: number,
  data: Uint8Array,
): DecodedCameraInfo | null {
  const msg = protobufRegistry.decode(schemaId, data)
  if (!msg) return null
  const obj = protobufRegistry.toObject(schemaId, msg) as Record<string, unknown>
  const width = Number(protoField(obj, 'width') ?? 0)
  const height = Number(protoField(obj, 'height') ?? 0)
  let K = toFloat64Array(protoField(obj, 'K', 'k'), 9)
  if (!(K[0] > 0)) {
    const P = toFloat64Array(protoField(obj, 'P', 'p'), 12)
    if (P.length >= 12 && P[0] > 0) {
      // P 3×4 → intrinsics in left 3×3
      K = Float64Array.from([P[0], P[1], P[2], P[4], P[5], P[6], P[8], P[9], P[10]])
    }
  }
  if (!width || !height || K.length < 9 || !(K[0] > 0)) return null
  return {
    topic,
    frameId: String(protoField(obj, 'frameId', 'frame_id') ?? ''),
    width,
    height,
    K,
    D: toFloat64Array(protoField(obj, 'D', 'd')),
    distortionModel: String(protoField(obj, 'distortionModel', 'distortion_model') ?? ''),
  }
}

export function isCameraInfoSchema(schemaName: string): boolean {
  return (
    schemaName.includes('CameraInfo') ||
    schemaName.includes('CameraCalibration') ||
    schemaName === 'foxglove.CameraCalibration'
  )
}
