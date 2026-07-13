import { MessageWriter, MessageReader } from '@foxglove/rosmsg2-serialization'
import { ros2humble, ros2jazzy } from '@foxglove/rosmsg-msgs-common'

/** Isaac / jazzy_ws 用 Jazzy；与 humble 布局相同时回退 humble */
const ros2msgs = ros2jazzy ?? ros2humble

/**
 * MessageWriter/MessageReader 以数组中第一个 MessageDefinition 为根类型，
 * 其余为依赖。根类型必须放在第一位，否则 CDR 会序列化/反序列化错误类型。
 */
const twistDefs = [
  ros2humble['geometry_msgs/Twist'],
  ros2humble['geometry_msgs/Vector3'],
]

const odomDefs = [
  ros2humble['nav_msgs/Odometry'],
  ros2humble['builtin_interfaces/Time'],
  ros2humble['std_msgs/Header'],
  ros2humble['geometry_msgs/Point'],
  ros2humble['geometry_msgs/Quaternion'],
  ros2humble['geometry_msgs/Pose'],
  ros2humble['geometry_msgs/PoseWithCovariance'],
  ros2humble['geometry_msgs/Twist'],
  ros2humble['geometry_msgs/Vector3'],
  ros2humble['geometry_msgs/TwistWithCovariance'],
]

export const twistWriter = new MessageWriter(twistDefs)
export const odomReader = new MessageReader(odomDefs)

export interface CmdVel {
  linear: { x: number; y: number; z: number }
  angular: { x: number; y: number; z: number }
}

export interface OdomPose {
  position: { x: number; y: number; z: number }
  orientation: { x: number; y: number; z: number; w: number }
}

export interface OdomMessage extends OdomPose {
  twist: {
    linear: { x: number; y: number; z: number }
    angular: { x: number; y: number; z: number }
  }
}

export function encodeTwist(cmd: CmdVel): Uint8Array {
  return twistWriter.writeMessage({
    linear: { x: cmd.linear.x, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: cmd.angular.z },
  })
}

export function decodeOdometry(data: Uint8Array): OdomMessage | null {
  try {
    const msg = odomReader.readMessage<{
      pose: {
        pose: {
          position: { x: number; y: number; z: number }
          orientation: { x: number; y: number; z: number; w: number }
        }
      }
      twist: {
        twist: {
          linear: { x: number; y: number; z: number }
          angular: { x: number; y: number; z: number }
        }
      }
    }>(data)
    return {
      position: msg.pose.pose.position,
      orientation: msg.pose.pose.orientation,
      twist: msg.twist.twist,
    }
  } catch {
    return null
  }
}

const imageDefs = [
  ros2humble['sensor_msgs/Image'],
  ros2humble['std_msgs/Header'],
  ros2humble['builtin_interfaces/Time'],
]

const compressedImageDefs = [
  ros2humble['sensor_msgs/CompressedImage'],
  ros2humble['std_msgs/Header'],
  ros2humble['builtin_interfaces/Time'],
]

export const imageReader = new MessageReader(imageDefs)
export const compressedImageReader = new MessageReader(compressedImageDefs)

export interface RosImageMessage {
  header: {
    stamp: { sec: number; nanosec: number }
    frame_id: string
  }
  height: number
  width: number
  encoding: string
  is_bigendian: number
  step: number
  data: Uint8Array
}

export interface RosCompressedImageMessage {
  header: {
    stamp: { sec: number; nanosec: number }
    frame_id: string
  }
  format: string
  data: Uint8Array
}

export interface DecodedCameraFrame {
  width: number
  height: number
  encoding: string
  stampSec: number
  stampNanosec: number
  frameId: string
  blobUrl: string
}

function normalizeImageData(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  }
  return new Uint8Array()
}

function mimeFromCompressed(format: string): string | null {
  const lower = format.toLowerCase()
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'image/jpeg'
  if (lower.includes('png')) return 'image/png'
  return null
}

async function rawImageToBlobUrl(msg: RosImageMessage): Promise<string | null> {
  const { width, height, encoding, step, data } = msg
  if (width <= 0 || height <= 0 || data.length === 0) return null

  const enc = encoding.toLowerCase()
  if (enc.includes('jpeg') || enc.includes('jpg')) {
    return URL.createObjectURL(new Blob([data], { type: 'image/jpeg' }))
  }
  if (enc.includes('png')) {
    return URL.createObjectURL(new Blob([data], { type: 'image/png' }))
  }

  const rgba = new Uint8ClampedArray(width * height * 4)
  const rowBytes = step > 0 ? step : width * (enc.startsWith('rgba') || enc.startsWith('bgra') ? 4 : 3)

  if (enc === 'rgb8') {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes
      for (let x = 0; x < width; x++) {
        const src = row + x * 3
        const dst = (y * width + x) * 4
        rgba[dst] = data[src] ?? 0
        rgba[dst + 1] = data[src + 1] ?? 0
        rgba[dst + 2] = data[src + 2] ?? 0
        rgba[dst + 3] = 255
      }
    }
  } else if (enc === 'bgr8') {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes
      for (let x = 0; x < width; x++) {
        const src = row + x * 3
        const dst = (y * width + x) * 4
        rgba[dst] = data[src + 2] ?? 0
        rgba[dst + 1] = data[src + 1] ?? 0
        rgba[dst + 2] = data[src] ?? 0
        rgba[dst + 3] = 255
      }
    }
  } else if (enc === 'rgba8') {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes
      for (let x = 0; x < width; x++) {
        const src = row + x * 4
        const dst = (y * width + x) * 4
        rgba[dst] = data[src] ?? 0
        rgba[dst + 1] = data[src + 1] ?? 0
        rgba[dst + 2] = data[src + 2] ?? 0
        rgba[dst + 3] = data[src + 3] ?? 255
      }
    }
  } else if (enc === 'bgra8') {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes
      for (let x = 0; x < width; x++) {
        const src = row + x * 4
        const dst = (y * width + x) * 4
        rgba[dst] = data[src + 2] ?? 0
        rgba[dst + 1] = data[src + 1] ?? 0
        rgba[dst + 2] = data[src] ?? 0
        rgba[dst + 3] = data[src + 3] ?? 255
      }
    }
  } else if (enc === 'mono8' || enc === '8uc1') {
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes
      for (let x = 0; x < width; x++) {
        const gray = data[row + x] ?? 0
        const dst = (y * width + x) * 4
        rgba[dst] = gray
        rgba[dst + 1] = gray
        rgba[dst + 2] = gray
        rgba[dst + 3] = 255
      }
    }
  } else {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(null)
        return
      }
      resolve(URL.createObjectURL(blob))
    }, 'image/png')
  })
}

export async function decodeImageMessage(
  data: Uint8Array,
  schemaName: string,
): Promise<DecodedCameraFrame | null> {
  try {
    if (schemaName.includes('CompressedImage')) {
      const msg = compressedImageReader.readMessage<RosCompressedImageMessage>(data)
      const bytes = normalizeImageData(msg.data)
      const mime = mimeFromCompressed(msg.format) ?? 'image/jpeg'
      if (bytes.length === 0) return null
      return {
        width: 0,
        height: 0,
        encoding: msg.format,
        stampSec: msg.header.stamp.sec,
        stampNanosec: msg.header.stamp.nanosec,
        frameId: msg.header.frame_id,
        blobUrl: URL.createObjectURL(new Blob([bytes], { type: mime })),
      }
    }

    const msg = imageReader.readMessage<RosImageMessage>(data)
    const bytes = normalizeImageData(msg.data)
    const blobUrl = await rawImageToBlobUrl({ ...msg, data: bytes })
    if (!blobUrl) return null

    return {
      width: msg.width,
      height: msg.height,
      encoding: msg.encoding,
      stampSec: msg.header.stamp.sec,
      stampNanosec: msg.header.stamp.nanosec,
      frameId: msg.header.frame_id,
      blobUrl,
    }
  } catch {
    return null
  }
}

export function isCameraImageTopic(topic: string, schemaName?: string): boolean {
  if (topic.includes('camera_info')) return false
  if (/\/out\/(theora|zstd|compressedDepth)/i.test(topic)) return false

  if (schemaName?.includes('CompressedImage')) {
    return /camera|stereo/i.test(topic)
  }
  if (schemaName?.includes('Image')) {
    return /image_raw/i.test(topic) && /camera|stereo/i.test(topic)
  }
  return /image_raw(\/compressed)?$/i.test(topic) && /camera|stereo/i.test(topic)
}

/** `/foo/image_raw` → `/foo/image_raw/compressed` */
export function toCompressedImageTopic(topic: string): string {
  if (topic.endsWith('/compressed')) return topic
  return `${topic.replace(/\/$/, '')}/compressed`
}

/** 有 compressed 同名话题时隐藏 raw，列表里只推荐 JPEG 流 */
export function preferCompressedCameraTopics(topics: readonly string[]): string[] {
  const set = new Set(topics)
  const picked = topics.filter((topic) => {
    if (topic.endsWith('/compressed')) return true
    if (/image_raw/i.test(topic) && !topic.endsWith('/compressed')) {
      if (set.has(toCompressedImageTopic(topic))) return false
    }
    return true
  })
  return [...new Set(picked)].sort()
}

/** 添加订阅时：若存在 compressed 则自动选用 */
export function resolvePreferredCameraTopic(
  topic: string,
  available: readonly string[],
): string {
  const trimmed = topic.trim()
  if (!trimmed) return trimmed
  if (trimmed.endsWith('/compressed')) return trimmed

  const compressed = toCompressedImageTopic(trimmed)
  if (available.includes(compressed)) return compressed

  const set = new Set(available)
  if (/image_raw/i.test(trimmed) && set.has(compressed)) return compressed

  return trimmed
}

const pointCloud2Defs = [
  ros2humble['sensor_msgs/PointCloud2'],
  ros2humble['sensor_msgs/PointField'],
  ros2humble['std_msgs/Header'],
  ros2humble['builtin_interfaces/Time'],
]

export const pointCloud2Reader = new MessageReader(pointCloud2Defs)

export interface RosPointField {
  name: string
  offset: number
  datatype: number
  count: number
}

export interface RosPointCloud2Message {
  header: {
    stamp: { sec: number; nanosec: number }
    frame_id: string
  }
  height: number
  width: number
  fields: RosPointField[]
  is_bigendian: boolean
  point_step: number
  row_step: number
  data: Uint8Array
  is_dense: boolean
}

export interface DecodedPointCloud {
  pointCount: number
  pointStep: number
  frameId: string
  stampSec: number
  stampNanosec: number
  /** x,y,z 交错 Float32，长度 ≥ pointCount×3 */
  positions: Float32Array
}

/** PointField datatype 7 = FLOAT32 */
const POINTFIELD_FLOAT32 = 7

function isSimpleXyzFloat32(fields: RosPointField[], pointStep: number): boolean {
  if (pointStep !== 12 || fields.length !== 3) return false
  const [x, y, z] = fields
  return (
    x?.name === 'x' &&
    x.offset === 0 &&
    x.datatype === POINTFIELD_FLOAT32 &&
    y?.name === 'y' &&
    y.offset === 4 &&
    y.datatype === POINTFIELD_FLOAT32 &&
    z?.name === 'z' &&
    z.offset === 8 &&
    z.datatype === POINTFIELD_FLOAT32
  )
}

/** Nova Carter lidar：12 字节/点 xyz Float32 → TypedArray 视图，无逐点循环 */
export function decodePointCloud2(data: Uint8Array): DecodedPointCloud | null {
  try {
    const msg = pointCloud2Reader.readMessage<RosPointCloud2Message>(data)
    const bytes = normalizeImageData(msg.data)
    const pointCount = msg.width * msg.height
    if (pointCount <= 0 || bytes.length < pointCount * msg.point_step) return null

    let positions: Float32Array

    if (isSimpleXyzFloat32(msg.fields, msg.point_step) && !Boolean(msg.is_bigendian)) {
      const floatCount = pointCount * 3
      if (bytes.byteOffset % 4 === 0 && bytes.length >= pointCount * 12) {
        positions = new Float32Array(bytes.buffer, bytes.byteOffset, floatCount)
      } else {
        const slice = bytes.slice(0, pointCount * 12)
        positions = new Float32Array(slice.buffer, slice.byteOffset, floatCount)
      }
    } else {
      positions = new Float32Array(pointCount * 3)
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const little = !msg.is_bigendian
      let fx = 0
      let fy = 4
      let fz = 8
      for (const f of msg.fields) {
        if (f.name === 'x') fx = f.offset
        if (f.name === 'y') fy = f.offset
        if (f.name === 'z') fz = f.offset
      }
      for (let i = 0; i < pointCount; i++) {
        const base = i * msg.point_step
        positions[i * 3] = view.getFloat32(base + fx, little)
        positions[i * 3 + 1] = view.getFloat32(base + fy, little)
        positions[i * 3 + 2] = view.getFloat32(base + fz, little)
      }
    }

    return {
      pointCount,
      pointStep: msg.point_step,
      frameId: msg.header.frame_id,
      stampSec: msg.header.stamp.sec,
      stampNanosec: msg.header.stamp.nanosec,
      positions,
    }
  } catch {
    return null
  }
}

export function isLidarPointCloudTopic(topic: string, schemaName?: string): boolean {
  if (schemaName?.includes('PointCloud2')) return true
  return /lidar|point_cloud|\/points$/i.test(topic)
}

const poseStampedDefs = [
  ros2humble['geometry_msgs/PoseStamped'],
  ros2humble['std_msgs/Header'],
  ros2humble['builtin_interfaces/Time'],
  ros2humble['geometry_msgs/Pose'],
  ros2humble['geometry_msgs/Point'],
  ros2humble['geometry_msgs/Quaternion'],
]

export const poseStampedWriter = new MessageWriter(poseStampedDefs)

export interface RosPoseStamped {
  header: { stamp: { sec: number; nanosec: number }; frame_id: string }
  pose: {
    position: { x: number; y: number; z: number }
    orientation: { x: number; y: number; z: number; w: number }
  }
}

const navigateToPoseRequestWriter = new MessageWriter([
  {
    name: 'carter_web_nav_bridge/srv/NavigateToPose_Request',
    definitions: [
      { name: 'pose', type: 'geometry_msgs/PoseStamped', isComplex: true },
    ],
  },
  ...poseStampedDefs,
])

/** carter_web_nav_bridge/srv/NavigateToPose request */
export function encodeNavigateToPoseRequest(pose: RosPoseStamped): Uint8Array {
  return navigateToPoseRequestWriter.writeMessage({ pose })
}

export function decodeBoolStringResponse(data: Uint8Array): { success: boolean; message: string } | null {
  try {
    const reader = new MessageReader([
      {
        name: 'Response',
        definitions: [
          { name: 'success', type: 'bool' },
          { name: 'message', type: 'string' },
        ],
      },
    ])
    const msg = reader.readMessage<{ success: boolean; message: string }>(data)
    return msg
  } catch {
    return null
  }
}

export function encodeEmptyServiceRequest(): Uint8Array {
  return new Uint8Array(0)
}

const navFeedbackDefs = [
  {
    name: 'nav2_msgs/action/NavigateToPose_FeedbackMessage',
    definitions: [
      { name: 'goal_id', type: 'unique_identifier_msgs/UUID', isComplex: true },
      { name: 'feedback', type: 'nav2_msgs/NavigateToPose_Feedback', isComplex: true },
    ],
  },
  {
    name: 'unique_identifier_msgs/UUID',
    definitions: [{ name: 'uuid', type: 'uint8', isArray: true, arrayLength: 16 }],
  },
  {
    name: 'nav2_msgs/NavigateToPose_Feedback',
    definitions: [
      { name: 'current_pose', type: 'geometry_msgs/PoseStamped', isComplex: true },
      { name: 'navigation_time', type: 'builtin_interfaces/Duration', isComplex: true },
      { name: 'estimated_time_remaining', type: 'builtin_interfaces/Duration', isComplex: true },
      { name: 'number_of_recoveries', type: 'int16' },
      { name: 'distance_remaining', type: 'float32' },
    ],
  },
  ros2humble['geometry_msgs/PoseStamped'],
  ros2humble['std_msgs/Header'],
  ros2humble['builtin_interfaces/Time'],
  ros2humble['geometry_msgs/Pose'],
  ros2humble['geometry_msgs/Point'],
  ros2humble['geometry_msgs/Quaternion'],
  ros2humble['builtin_interfaces/Duration'],
]

const navFeedbackReader = new MessageReader(navFeedbackDefs)

export interface NavGoalFeedback {
  distanceRemaining: number
  recoveries: number
  currentPose: RosPoseStamped['pose'] & { frameId: string }
}

export function decodeNavGoalFeedback(data: Uint8Array): NavGoalFeedback | null {
  try {
    const msg = navFeedbackReader.readMessage<{
      feedback: {
        current_pose: RosPoseStamped
        number_of_recoveries: number
        distance_remaining: number
      }
    }>(data)
    const fb = msg.feedback
    return {
      distanceRemaining: fb.distance_remaining,
      recoveries: fb.number_of_recoveries,
      currentPose: {
        ...fb.current_pose.pose,
        frameId: fb.current_pose.header.frame_id,
      },
    }
  } catch {
    return null
  }
}

const navStatusDefs = [
  {
    name: 'action_msgs/msg/GoalStatusArray',
    definitions: [
      { name: 'status_list', type: 'action_msgs/GoalStatus', isArray: true },
    ],
  },
  {
    name: 'action_msgs/GoalStatus',
    definitions: [
      { name: 'goal_info', type: 'action_msgs/GoalInfo', isComplex: true },
      { name: 'status', type: 'int8' },
    ],
  },
  {
    name: 'action_msgs/GoalInfo',
    definitions: [
      { name: 'goal_id', type: 'unique_identifier_msgs/UUID', isComplex: true },
      { name: 'stamp', type: 'builtin_interfaces/Time', isComplex: true },
    ],
  },
  {
    name: 'unique_identifier_msgs/UUID',
    definitions: [{ name: 'uuid', type: 'uint8', isArray: true, arrayLength: 16 }],
  },
  ros2humble['builtin_interfaces/Time'],
]

const navStatusReader = new MessageReader(navStatusDefs)

/** action_msgs/GoalStatus status codes */
export const GOAL_STATUS = {
  UNKNOWN: 0,
  ACCEPTED: 1,
  EXECUTING: 2,
  CANCELING: 3,
  SUCCEEDED: 4,
  CANCELED: 5,
  ABORTED: 6,
} as const

export function decodeNavGoalStatus(data: Uint8Array): number | null {
  try {
    const msg = navStatusReader.readMessage<{ status_list: { status: number }[] }>(data)
    const latest = msg.status_list[msg.status_list.length - 1]
    return latest?.status ?? null
  } catch {
    return null
  }
}

/**
 * 必须用官方定义（含 isComplex: true）。
 * 手写 `{ isArray: true }` 缺 isComplex 会导致 unbounded sequence 解失败，
 * 表现：Bridge 已订 /tf，但 tfRuntimeStore 永远为空；odom 不受影响。
 */
const tfMessageDefs = [
  ros2msgs['tf2_msgs/TFMessage'],
  ros2msgs['geometry_msgs/TransformStamped'],
  ros2msgs['std_msgs/Header'],
  ros2msgs['builtin_interfaces/Time'],
  ros2msgs['geometry_msgs/Transform'],
  ros2msgs['geometry_msgs/Vector3'],
  ros2msgs['geometry_msgs/Quaternion'],
]

const tfMessageReader = new MessageReader(tfMessageDefs)

export interface DecodedTfTransform {
  parentFrame: string
  childFrame: string
  transform: {
    translation: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
}

let tfDecodeFailLogged = false

export function decodeTfMessage(data: Uint8Array): DecodedTfTransform[] | null {
  try {
    const msg = tfMessageReader.readMessage<{
      transforms: Array<{
        header: { frame_id: string }
        child_frame_id: string
        transform: {
          translation: { x: number; y: number; z: number }
          rotation: { x: number; y: number; z: number; w: number }
        }
      }>
    }>(data)

    if (!msg.transforms || !Array.isArray(msg.transforms)) {
      if (!tfDecodeFailLogged) {
        tfDecodeFailLogged = true
        console.warn('[TF] decodeTfMessage: transforms 非数组', msg)
      }
      return null
    }

    return msg.transforms.map((t) => ({
      parentFrame: t.header.frame_id,
      childFrame: t.child_frame_id,
      transform: t.transform,
    }))
  } catch (err) {
    if (!tfDecodeFailLogged) {
      tfDecodeFailLogged = true
      console.warn('[TF] decodeTfMessage CDR 失败', {
        byteLength: data.byteLength,
        err: err instanceof Error ? err.message : String(err),
      })
    }
    return null
  }
}
