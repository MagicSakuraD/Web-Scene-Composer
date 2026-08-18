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
  /** header.frame_id，通常为 odom */
  frameId: string
  /** child_frame_id，通常为 base_link */
  childFrameId: string
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
      header?: { frame_id?: string }
      child_frame_id?: string
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
      frameId: msg.header?.frame_id ?? 'odom',
      childFrameId: msg.child_frame_id ?? 'base_link',
    }
  } catch {
    return null
  }
}

const imageDefs = [
  (ros2jazzy ?? ros2humble)['sensor_msgs/Image'],
  (ros2jazzy ?? ros2humble)['std_msgs/Header'],
  (ros2jazzy ?? ros2humble)['builtin_interfaces/Time'],
].filter((d): d is NonNullable<typeof d> => d != null)

const compressedImageDefs = [
  (ros2jazzy ?? ros2humble)['sensor_msgs/CompressedImage'],
  (ros2jazzy ?? ros2humble)['std_msgs/Header'],
  (ros2jazzy ?? ros2humble)['builtin_interfaces/Time'],
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
  /** WebCodecs 解码后的位图（调用方负责 close 旧帧） */
  bitmap: ImageBitmap
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

/** 解析 CompressedImage CDR；H.264 像素解码见 h264-webcodecs-decoder */
export function parseCompressedImageMessage(data: Uint8Array): RosCompressedImageMessage | null {
  try {
    const msg = compressedImageReader.readMessage<RosCompressedImageMessage>(data)
    return {
      ...msg,
      data: normalizeImageData(msg.data),
    }
  } catch {
    return null
  }
}

/** @deprecated 使用 parseCompressedImageMessage + H264TopicDecoder */
export async function decodeImageMessage(
  _data: Uint8Array,
  _schemaName: string,
): Promise<DecodedCameraFrame | null> {
  return null
}

export function isCameraImageTopic(topic: string, schemaName?: string): boolean {
  if (topic.includes('camera_info')) return false
  if (/\/out\/(theora|zstd|compressedDepth)/i.test(topic)) return false

  if (schemaName === 'foxglove.CompressedImage' || schemaName?.includes('foxglove.CompressedImage')) {
    return /image|camera|CAM_/i.test(topic)
  }
  if (schemaName?.includes('CompressedImage')) {
    return true
  }
  if (schemaName?.includes('Image') && !schemaName.includes('CompressedImage')) {
    return /image_raw/i.test(topic) || /CAM_|camera|stereo/i.test(topic)
  }
  return /image_raw(\/compressed)?$|image_rect_compressed$/i.test(topic) && /camera|stereo|CAM_/i.test(topic)
}

/** `/foo/image_raw` → `/foo/image_raw/compressed` */
export function toCompressedImageTopic(topic: string): string {
  if (topic.endsWith('/compressed')) return topic
  return `${topic.replace(/\/$/, '')}/compressed`
}

/** 有 compressed 同名话题时隐藏 raw，列表里只推荐 compressed 流 */
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
  if (schemaName) {
    if (schemaName.includes('LaserScan')) return false
    return schemaName.includes('PointCloud2') || schemaName.includes('foxglove.PointCloud')
  }
  // 无 schema 时保守匹配，排除 costmap / occupancy / LaserScan 等
  if (/costmap|occupancy|CostmapUpdate|_layer$/i.test(topic)) return false
  if (/\/scan$|laser_scan|LaserScan/i.test(topic)) return false
  return /lidar|LIDAR|point_cloud|\/points$|cost_cloud|RADAR/i.test(topic)
}

const laserScanDefs = [
  ros2msgs['sensor_msgs/LaserScan'] ?? ros2humble['sensor_msgs/LaserScan'],
  ros2msgs['std_msgs/Header'] ?? ros2humble['std_msgs/Header'],
  ros2msgs['builtin_interfaces/Time'] ?? ros2humble['builtin_interfaces/Time'],
].filter((d): d is NonNullable<typeof d> => d != null)

const laserScanReader =
  laserScanDefs.length >= 1 ? new MessageReader(laserScanDefs) : null

export interface DecodedLaserScan {
  frameId: string
  stampSec: number
  stampNanosec: number
  angleMin: number
  angleMax: number
  angleIncrement: number
  rangeMin: number
  rangeMax: number
  pointCount: number
  /** laser frame xyz interleaved */
  positions: Float32Array
}

/** sensor_msgs/msg/LaserScan → polar → Cartesian in laser frame (z=0) */
export function decodeLaserScan(data: Uint8Array): DecodedLaserScan | null {
  if (!laserScanReader) return null
  try {
    const msg = laserScanReader.readMessage<{
      header: { stamp: { sec: number; nanosec: number }; frame_id: string }
      angle_min: number
      angle_max: number
      angle_increment: number
      range_min: number
      range_max: number
      ranges: number[] | Float32Array
    }>(data)
    const ranges = msg.ranges
    const n = ranges?.length ?? 0
    if (n <= 0) return null
    const angleMin = Number(msg.angle_min)
    const angleInc = Number(msg.angle_increment)
    const rangeMin = Number(msg.range_min)
    const rangeMax = Number(msg.range_max)
    const positions = new Float32Array(n * 3)
    let count = 0
    for (let i = 0; i < n; i++) {
      const r = Number(ranges[i])
      if (!Number.isFinite(r) || r < rangeMin || r > rangeMax) continue
      const angle = angleMin + i * angleInc
      const idx = count * 3
      positions[idx] = r * Math.cos(angle)
      positions[idx + 1] = r * Math.sin(angle)
      positions[idx + 2] = 0
      count++
    }
    if (count === 0) return null
    return {
      frameId: msg.header?.frame_id ?? '',
      stampSec: msg.header?.stamp?.sec ?? 0,
      stampNanosec: msg.header?.stamp?.nanosec ?? 0,
      angleMin,
      angleMax: Number(msg.angle_max),
      angleIncrement: angleInc,
      rangeMin,
      rangeMax,
      pointCount: count,
      positions: positions.subarray(0, count * 3),
    }
  } catch {
    return null
  }
}

export function isLaserScanTopic(topic: string, schemaName?: string): boolean {
  if (schemaName?.includes('LaserScan')) return true
  return /\/scan$|laser_scan|LaserScan/i.test(topic)
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
  ros2msgs['action_msgs/GoalStatusArray'],
  ros2msgs['action_msgs/GoalStatus'],
  ros2msgs['action_msgs/GoalInfo'],
  ros2msgs['unique_identifier_msgs/UUID'],
  ros2msgs['builtin_interfaces/Time'],
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

let navStatusDecodeFailLogged = false

export function decodeNavGoalStatus(data: Uint8Array): number | null {
  try {
    const msg = navStatusReader.readMessage<{
      status_list: Array<{ status: number; goal_info: { stamp: { sec: number; nanosec: number } } }>
    }>(data)
    if (!msg.status_list?.length) return null

    // 取 stamp 最新的一条（新 goal 会更新 stamp；勿优先旧 SUCCEEDED）
    let best = msg.status_list[0]
    let bestStamp = best.goal_info.stamp.sec * 1e9 + best.goal_info.stamp.nanosec
    for (let i = 1; i < msg.status_list.length; i++) {
      const entry = msg.status_list[i]
      const entryStamp = entry.goal_info.stamp.sec * 1e9 + entry.goal_info.stamp.nanosec
      if (entryStamp >= bestStamp) {
        best = entry
        bestStamp = entryStamp
      }
    }
    return best?.status ?? null
  } catch (err) {
    if (!navStatusDecodeFailLogged) {
      navStatusDecodeFailLogged = true
      console.warn('[NavGoal] decodeNavGoalStatus CDR 失败（jazzy action_msgs）', {
        byteLength: data.byteLength,
        err: err instanceof Error ? err.message : String(err),
      })
    }
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

const pathDefs = [
  ros2msgs['nav_msgs/Path'],
  ros2msgs['std_msgs/Header'],
  ros2msgs['builtin_interfaces/Time'],
  ros2msgs['geometry_msgs/PoseStamped'],
  ros2msgs['geometry_msgs/Pose'],
  ros2msgs['geometry_msgs/Point'],
  ros2msgs['geometry_msgs/Quaternion'],
]

const pathReader = new MessageReader(pathDefs)

export interface DecodedNavPath {
  frameId: string
  poses: { x: number; y: number; z: number }[]
}

/** nav_msgs/msg/Path — jazzy_ws / Isaac Sim */
export function decodeNavPath(data: Uint8Array): DecodedNavPath | null {
  try {
    const msg = pathReader.readMessage<{
      header: { frame_id: string }
      poses: Array<{
        pose: { position: { x: number; y: number; z: number } }
      }>
    }>(data)
    if (!msg.poses?.length) return null
    return {
      frameId: msg.header.frame_id,
      poses: msg.poses.map((p) => p.pose.position),
    }
  } catch {
    return null
  }
}

const occupancyGridDefs = [
  ros2msgs['nav_msgs/OccupancyGrid'] ?? ros2humble['nav_msgs/OccupancyGrid'],
  ros2msgs['nav_msgs/MapMetaData'] ?? ros2humble['nav_msgs/MapMetaData'],
  ros2msgs['std_msgs/Header'] ?? ros2humble['std_msgs/Header'],
  ros2msgs['builtin_interfaces/Time'] ?? ros2humble['builtin_interfaces/Time'],
  ros2msgs['geometry_msgs/Pose'] ?? ros2humble['geometry_msgs/Pose'],
  ros2msgs['geometry_msgs/Point'] ?? ros2humble['geometry_msgs/Point'],
  ros2msgs['geometry_msgs/Quaternion'] ?? ros2humble['geometry_msgs/Quaternion'],
].filter((d): d is NonNullable<typeof d> => d != null)

const occupancyGridReader = new MessageReader(occupancyGridDefs)

export interface DecodedOccupancyGrid {
  frameId: string
  resolution: number
  width: number
  height: number
  origin: {
    position: { x: number; y: number; z: number }
    orientation: { x: number; y: number; z: number; w: number }
  }
  /** row-major, cell (x,y) at index y*width+x；Nav2: -1 unknown, 0 free, 1–99 cost, 100 lethal */
  data: Int8Array
}

/** nav_msgs/msg/OccupancyGrid — jazzy_ws / Nav2 local_costmap */
export function decodeOccupancyGrid(data: Uint8Array): DecodedOccupancyGrid | null {
  try {
    const msg = occupancyGridReader.readMessage<{
      header: { frame_id: string }
      info: {
        resolution: number
        width: number
        height: number
        origin: {
          position: { x: number; y: number; z: number }
          orientation: { x: number; y: number; z: number; w: number }
        }
      }
      data: Int8Array | Uint8Array | number[]
    }>(data)

    const width = Number(msg.info?.width ?? 0)
    const height = Number(msg.info?.height ?? 0)
    if (!width || !height || !msg.info?.resolution) return null

    const raw = msg.data
    const cells = width * height
    let grid: Int8Array
    if (raw instanceof Int8Array) {
      grid = raw.length >= cells ? raw.subarray(0, cells) : Int8Array.from(raw)
    } else if (raw instanceof Uint8Array) {
      // CDR 有时给出无符号视图；255 → -1 (unknown)
      grid = new Int8Array(raw.buffer, raw.byteOffset, Math.min(raw.byteLength, cells))
    } else if (Array.isArray(raw)) {
      grid = Int8Array.from(raw.slice(0, cells))
    } else {
      return null
    }

    const o = msg.info.origin
    return {
      frameId: msg.header?.frame_id ?? '',
      resolution: msg.info.resolution,
      width,
      height,
      origin: {
        position: {
          x: o?.position?.x ?? 0,
          y: o?.position?.y ?? 0,
          z: o?.position?.z ?? 0,
        },
        orientation: {
          x: o?.orientation?.x ?? 0,
          y: o?.orientation?.y ?? 0,
          z: o?.orientation?.z ?? 0,
          w: o?.orientation?.w ?? 1,
        },
      },
      data: grid,
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Costmap] decodeOccupancyGrid CDR 失败', {
        byteLength: data.byteLength,
        err: err instanceof Error ? err.message : String(err),
      })
    }
    return null
  }
}

const btLogDefs = [
  {
    name: 'nav2_msgs/BehaviorTreeLog',
    definitions: [
      { name: 'timestamp', type: 'builtin_interfaces/Time', isComplex: true },
      {
        name: 'event_log',
        type: 'nav2_msgs/BehaviorTreeStatusChange',
        isComplex: true,
        isArray: true,
      },
    ],
  },
  {
    name: 'nav2_msgs/BehaviorTreeStatusChange',
    definitions: [
      { name: 'timestamp', type: 'builtin_interfaces/Time', isComplex: true },
      { name: 'node_name', type: 'string' },
      { name: 'uid', type: 'uint16' },
      { name: 'previous_status', type: 'string' },
      { name: 'current_status', type: 'string' },
    ],
  },
  ros2humble['builtin_interfaces/Time'],
]

const btLogReader = new MessageReader(btLogDefs)

export interface BehaviorTreeStatusChange {
  nodeName: string
  uid: number
  previousStatus: string
  currentStatus: string
}

export interface DecodedBehaviorTreeLog {
  eventLog: BehaviorTreeStatusChange[]
}

let btLogDecodeFailLogged = false

/** nav2_msgs/msg/BehaviorTreeLog — bt_navigator /behavior_tree_log */
export function decodeBehaviorTreeLog(data: Uint8Array): DecodedBehaviorTreeLog | null {
  try {
    const msg = btLogReader.readMessage<{
      event_log: Array<{
        node_name: string
        uid: number
        previous_status: string
        current_status: string
      }>
    }>(data)
    if (!msg.event_log?.length) return { eventLog: [] }
    return {
      eventLog: msg.event_log.map((e) => ({
        nodeName: e.node_name,
        uid: e.uid,
        previousStatus: e.previous_status,
        currentStatus: e.current_status,
      })),
    }
  } catch (err) {
    if (!btLogDecodeFailLogged) {
      btLogDecodeFailLogged = true
      console.warn('[BT] decodeBehaviorTreeLog CDR 失败', {
        byteLength: data.byteLength,
        err: err instanceof Error ? err.message : String(err),
      })
    }
    return null
  }
}

export interface StartJobRequest {
  pick_location_id: string
  drop_location_id: string
  pick_x: number
  pick_y: number
  pick_yaw: number
  drop_x: number
  drop_y: number
  drop_yaw: number
  pick_tag: number
  drop_tag: number
}

const startJobRequestWriter = new MessageWriter([
  {
    name: 'shelf_mission_interfaces/srv/StartJob_Request',
    definitions: [
      { name: 'pick_location_id', type: 'string' },
      { name: 'drop_location_id', type: 'string' },
      { name: 'pick_x', type: 'float64' },
      { name: 'pick_y', type: 'float64' },
      { name: 'pick_yaw', type: 'float64' },
      { name: 'drop_x', type: 'float64' },
      { name: 'drop_y', type: 'float64' },
      { name: 'drop_yaw', type: 'float64' },
      { name: 'pick_tag', type: 'int32' },
      { name: 'drop_tag', type: 'int32' },
    ],
  },
])

export function encodeStartJobRequest(req: StartJobRequest): Uint8Array {
  return startJobRequestWriter.writeMessage({
    pick_location_id: req.pick_location_id,
    drop_location_id: req.drop_location_id,
    pick_x: req.pick_x,
    pick_y: req.pick_y,
    pick_yaw: req.pick_yaw,
    drop_x: req.drop_x,
    drop_y: req.drop_y,
    drop_yaw: req.drop_yaw,
    pick_tag: req.pick_tag,
    drop_tag: req.drop_tag,
  })
}

export function decodeStartJobResponse(
  data: Uint8Array,
): { accepted: boolean; message: string } | null {
  try {
    const reader = new MessageReader([
      {
        name: 'shelf_mission_interfaces/srv/StartJob_Response',
        definitions: [
          { name: 'accepted', type: 'bool' },
          { name: 'message', type: 'string' },
        ],
      },
    ])
    return reader.readMessage<{ accepted: boolean; message: string }>(data)
  } catch {
    return null
  }
}

export interface DecodedJobStatus {
  phase: number
  phaseName: string
  message: string
  errorCode: number
  childErrorCode: number
  progress: number
}

/** 必须与 shelf_mission_interfaces/msg/JobStatus.msg 一致；int32 会让 CDR 读过头并整包丢弃 */
const jobStatusDefs = [
  { name: 'phase', type: 'uint8' },
  { name: 'phase_name', type: 'string' },
  { name: 'message', type: 'string' },
  { name: 'error_code', type: 'uint8' },
  { name: 'child_error_code', type: 'uint16' },
  { name: 'progress', type: 'float32' },
] as const

const jobStatusReader = new MessageReader([
  {
    name: 'shelf_mission_interfaces/msg/JobStatus',
    definitions: [...jobStatusDefs],
  },
])

let jobStatusDecodeFailLogged = false

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapJobStatusFields(msg: Record<string, unknown>): DecodedJobStatus {
  return {
    phase: asFiniteNumber(msg.phase ?? msg.phase_id),
    phaseName: String(msg.phase_name ?? msg.phaseName ?? ''),
    message: String(msg.message ?? ''),
    errorCode: asFiniteNumber(msg.error_code ?? msg.errorCode),
    childErrorCode: asFiniteNumber(msg.child_error_code ?? msg.childErrorCode),
    progress: asFiniteNumber(msg.progress),
  }
}

function decodeJobStatusJson(data: Uint8Array): DecodedJobStatus | null {
  if (data.byteLength < 2) return null
  const start = data[0]
  if (start !== 0x7b && start !== 0x5b && start !== 0x20 && start !== 0x0a) return null
  try {
    const parsed = JSON.parse(new TextDecoder().decode(data)) as unknown
    const obj =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    if (!obj) return null
    if (obj.phase == null && obj.phase_name == null && obj.phaseName == null) return null
    return mapJobStatusFields(obj)
  } catch {
    return null
  }
}

function decodeJobStatusCdr(data: Uint8Array): DecodedJobStatus | null {
  const attempts: Uint8Array[] = [data]
  if (data.byteLength > 8) {
    const kind = data[1]
    const delimited = kind === 0x08 || kind === 0x09 || kind === 0x14 || kind === 0x15
    if (delimited) {
      const rewritten = new Uint8Array(data.byteLength - 4)
      rewritten[0] = data[0]
      rewritten[1] = kind === 0x09 || kind === 0x15 ? 0x01 : 0x00
      rewritten[2] = data[2]
      rewritten[3] = data[3]
      rewritten.set(data.subarray(8), 4)
      attempts.push(rewritten)
    }
  }

  for (const buf of attempts) {
    try {
      const msg = jobStatusReader.readMessage<Record<string, unknown>>(buf)
      const mapped = mapJobStatusFields(msg)
      if (
        mapped.phase !== 0 ||
        mapped.phaseName.length > 0 ||
        mapped.message.length > 0 ||
        mapped.progress > 0
      ) {
        return mapped
      }
    } catch {
      /* try next layout */
    }
  }
  return null
}

/** shelf_mission_interfaces/msg/JobStatus — Foxglove 可能是 cdr 或 json */
export function decodeJobStatus(
  data: Uint8Array,
  encoding?: string,
): DecodedJobStatus | null {
  const enc = encoding?.toLowerCase() ?? ''
  const jsonFirst = enc.includes('json')
  const decoded = jsonFirst
    ? (decodeJobStatusJson(data) ?? decodeJobStatusCdr(data))
    : (decodeJobStatusCdr(data) ?? decodeJobStatusJson(data))
  if (decoded) return decoded
  if (!jobStatusDecodeFailLogged) {
    jobStatusDecodeFailLogged = true
    console.warn('[ShelfJob] decodeJobStatus 失败', {
      encoding: encoding || '(unknown)',
      byteLength: data.byteLength,
      head: Array.from(data.subarray(0, 16)),
    })
  }
  return null
}
