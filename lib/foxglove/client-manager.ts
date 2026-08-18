import { FoxgloveClient } from '@foxglove/ws-protocol'
import type { Channel, ClientChannelId, Service, SubscriptionId } from '@foxglove/ws-protocol'
import type { McapTopicInfo } from '@/lib/playback/atoms'
import {
  encodeTwist,
  decodeOdometry,
  decodeTfMessage,
  decodePointCloud2,
  decodeLaserScan,
  isCameraImageTopic,
  isLidarPointCloudTopic,
  isLaserScanTopic,
  preferCompressedCameraTopics,
  encodeNavigateToPoseRequest,
  encodeEmptyServiceRequest,
  decodeBoolStringResponse,
  decodeNavGoalFeedback,
  decodeNavGoalStatus,
  decodeNavPath,
  decodeOccupancyGrid,
  decodeBehaviorTreeLog,
  encodeStartJobRequest,
  decodeStartJobResponse,
  decodeJobStatus,
  type CmdVel,
  type DecodedCameraFrame,
  type DecodedLaserScan,
  type DecodedPointCloud,
  type RosPoseStamped,
  type StartJobRequest,
} from '@/lib/foxglove/ros-serialization'
import { decodeRosCameraInfo } from '@/lib/ros/decode-camera-info'
import type { DecodedCameraInfo } from '@/lib/ros/camera-info-store'
import { isCameraInfoTopic } from '@/lib/ros/resolve-camera-topics'
import {
  releaseAllH264Decoders,
  releaseH264Decoder,
} from '@/lib/ros/h264-webcodecs-decoder'
import { FOXGLOVE_WS_CANDIDATES, FOXGLOVE_WS_SUBPROTOCOLS } from '@/lib/ros/foxglove-config'
import {
  CMD_VEL_TOPIC,
  ODOM_TOPIC_CANDIDATES,
  TF_TOPIC,
  TF_STATIC_TOPIC,
  type SimulateLogEntry,
} from '@/lib/ros/atoms'
import {
  NAV_CANCEL_SERVICE,
  NAV_FEEDBACK_TOPIC,
  NAV_GOAL_SERVICE,
  NAV_STATUS_TOPIC,
  BT_LOG_TOPIC,
  LOCAL_PLAN_TOPIC,
  PLAN_SMOOTHED_TOPIC,
  PLAN_TOPIC,
} from '@/lib/ros/nav-goal-config'
import {
  JOB_CANCEL_SERVICE,
  JOB_START_SERVICE,
  JOB_STATUS_TOPIC,
} from '@/lib/ros/shelf-job-config'
import { navGoalStore } from '@/lib/ros/nav-goal-store'
import { shelfJobStore } from '@/lib/ros/shelf-job-store'
import { navPathStore } from '@/lib/ros/nav-path-store'
import { btTimelineStore } from '@/lib/ros/bt-timeline-store'
import {
  costmapStores,
  costmapStoreByTopic,
  type CostmapStore,
} from '@/lib/ros/costmap-store'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'

type LogFn = (entry: Omit<SimulateLogEntry, 'id' | 'time'>) => void
type OdomFn = (pose: ReturnType<typeof decodeOdometry>) => void
type ImageFrameFn = (topic: string, frame: DecodedCameraFrame) => void
type PointCloudFn = (topic: string, cloud: DecodedPointCloud) => void
type LaserScanFn = (topic: string, scan: DecodedLaserScan) => void
type CameraInfoFn = (topic: string, info: DecodedCameraInfo) => void
type TopicsListener = () => void

const EMPTY_CAMERA_TOPICS: readonly string[] = []
const EMPTY_LIDAR_TOPICS: readonly string[] = []
const TF_DEBUG_CHILD = 'caster_swivel_left'
const TF_DEBUG_THROTTLE_MS = 800
const TF_DEBUG_LIST_LIMIT = 24

interface ImageSubscription {
  topic: string
  channelId: number | null
  subscriptionId: SubscriptionId | null
  schemaName: string
  callbacks: Set<ImageFrameFn>
  lastFrameAt: number
}

interface PointCloudSubscription {
  topic: string
  channelId: number | null
  subscriptionId: SubscriptionId | null
  schemaName: string
  callbacks: Set<PointCloudFn>
}

interface LaserScanSubscription {
  topic: string
  channelId: number | null
  subscriptionId: SubscriptionId | null
  schemaName: string
  callbacks: Set<LaserScanFn>
}

interface CameraInfoSubscription {
  topic: string
  channelId: number | null
  subscriptionId: SubscriptionId | null
  schemaName: string
  callbacks: Set<CameraInfoFn>
}

const IMAGE_UI_MAX_FPS = 30

function toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
}

class FoxgloveBridgeManager {
  private client: FoxgloveClient | null = null
  private ws: WebSocket | null = null
  private connectedUrl: string | null = null
  private cmdVelChannelId: ClientChannelId | null = null
  private odomSubscriptionId: SubscriptionId | null = null
  private odomChannelId: number | null = null
  private tfSubscriptionId: SubscriptionId | null = null
  private tfStaticSubscriptionId: SubscriptionId | null = null
  private clientPublishEnabled = false
  private servicesEnabled = false
  private connectGeneration = 0
  private log: LogFn = () => {}
  private onOdom: OdomFn = () => {}
  private channels: Channel[] = []
  /** Foxglove advertise 是增量推送的，需按 id 累积（否则后到的一批会覆盖之前的话题） */
  private channelsById = new Map<number, Channel>()
  private services: Service[] = []
  private nextServiceCallId = 1
  private pendingServiceCalls = new Map<
    number,
    { resolve: (data: Uint8Array) => void; reject: (err: Error) => void }
  >()
  private navFeedbackSubscriptionId: SubscriptionId | null = null
  private navStatusSubscriptionId: SubscriptionId | null = null
  private navPlanSmoothedSubscriptionId: SubscriptionId | null = null
  private navPlanSubscriptionId: SubscriptionId | null = null
  private navLocalPlanSubscriptionId: SubscriptionId | null = null
  private btLogSubscriptionId: SubscriptionId | null = null
  /** topic → 订阅 id（local + global costmap） */
  private costmapSubscriptionIds = new Map<string, SubscriptionId>()
  private navGoalActive = false
  private shelfJobActive = false
  private jobStatusSubscriptionId: SubscriptionId | null = null
  private jobStatusEncoding = 'cdr'
  private servicesById = new Map<number, Service>()
  private costmapHooksBound = false
  private costmapVisibilityUnsubs: (() => void)[] = []
  private cachedCameraTopics: readonly string[] = EMPTY_CAMERA_TOPICS
  private cachedLidarTopics: readonly string[] = EMPTY_LIDAR_TOPICS
  private imageSubs = new Map<string, ImageSubscription>()
  private pointCloudSubs = new Map<string, PointCloudSubscription>()
  private laserScanSubs = new Map<string, LaserScanSubscription>()
  private cameraInfoSubs = new Map<string, CameraInfoSubscription>()
  private topicListeners = new Set<TopicsListener>()
  /** Fired on any channel advertise/unadvertise (full topic list for Topics panel) */
  private channelListeners = new Set<TopicsListener>()
  private cachedTopicInfos: McapTopicInfo[] = []
  private lidarTopicListeners = new Set<TopicsListener>()
  private lastTfDebugAt = 0

  /** Simulate：建立 WebSocket 并订阅 odom（自动尝试 127.0.0.1 / localhost） */
  async connect(log: LogFn, onOdom: OdomFn): Promise<void> {
    this.log = log
    this.onOdom = onOdom
    this.disconnect()

    const generation = ++this.connectGeneration
    let lastError: Error | null = null

    for (const url of FOXGLOVE_WS_CANDIDATES) {
      if (generation !== this.connectGeneration) {
        throw new Error('连接已取消')
      }
      try {
        await this.connectOnce(url, generation)
        this.connectedUrl = url
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        this.log({ level: 'warn', message: `${url} 连接失败: ${lastError.message}` })
        this.cleanupSocket()
      }
    }

    throw lastError ?? new Error('无法连接 Foxglove Bridge')
  }

  private connectOnce(url: string, generation: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }

      try {
        const ws = new WebSocket(url, [...FOXGLOVE_WS_SUBPROTOCOLS])
        this.ws = ws
        const client = new FoxgloveClient({ ws })
        this.client = client

        const timeout = window.setTimeout(() => {
          finish(() => {
            ws.close()
            reject(new Error('连接超时 (8s)'))
          })
        }, 8000)

        ws.addEventListener('open', () => {
          if (generation !== this.connectGeneration) return
          this.log({
            level: 'info',
            message: `WebSocket 已连接 ${url} · 协议: ${ws.protocol || 'unknown'}`,
          })
        })

        client.on('serverInfo', (info) => {
          if (generation !== this.connectGeneration) return
          window.clearTimeout(timeout)
          this.clientPublishEnabled = info.capabilities.includes('clientPublish')
          this.servicesEnabled = info.capabilities.includes('services')
          this.log({
            level: 'info',
            message: `Bridge: ${info.name} · capabilities: ${info.capabilities.join(', ')}`,
          })
          if (!this.clientPublishEnabled) {
            this.log({
              level: 'warn',
              message: 'Bridge 未开启 clientPublish，差速驱动控制器将无法发布 /cmd_vel',
            })
          }
          finish(resolve)
        })

        client.on('advertise', (channels: Channel[]) => {
          if (generation !== this.connectGeneration) return
          // advertise 为增量：累积而非覆盖，否则后到的 Nav2 话题会挤掉已有相机/里程计等
          for (const ch of channels) this.channelsById.set(ch.id, ch)
          this.channels = Array.from(this.channelsById.values())
          this.notifyTopicListeners()
          this.notifyLidarTopicListeners()
          this.notifyChannelListeners()
          this.syncOdomSubscription(client)
          this.syncTfSubscription(client)
          this.syncImageSubscriptions(client)
          this.syncPointCloudSubscriptions(client)
          this.syncLaserScanSubscriptions(client)
          this.syncCameraInfoSubscriptions(client)
          if (this.navGoalActive) {
            this.syncNavGoalSubscriptions(client)
            this.syncNavPathSubscriptions(client)
            this.syncCostmapSubscriptions(client)
            this.syncBtLogSubscription(client)
          }
          if (this.shelfJobActive) {
            this.syncJobStatusSubscription(client)
          }
        })

        client.on('unadvertise', (channelIds: number[]) => {
          if (generation !== this.connectGeneration) return
          let changed = false
          for (const id of channelIds) {
            if (this.channelsById.delete(id)) changed = true
          }
          if (!changed) return
          this.channels = Array.from(this.channelsById.values())
          this.notifyTopicListeners()
          this.notifyLidarTopicListeners()
          this.notifyChannelListeners()
        })

        client.on('advertiseServices', (services: Service[]) => {
          if (generation !== this.connectGeneration) return
          for (const s of services) this.servicesById.set(s.id, s)
          this.services = Array.from(this.servicesById.values())
          const hasNav = this.services.some((s) => s.name === NAV_GOAL_SERVICE)
          const hasCancel = this.services.some((s) => s.name === NAV_CANCEL_SERVICE)
          navGoalStore.setServicesReady(hasNav && hasCancel)
          this.refreshShelfJobServices()
          if (hasNav && hasCancel) {
            this.log({ level: 'info', message: 'Nav2 桥接服务已发现' })
            if (this.navGoalActive) {
              this.syncNavGoalSubscriptions(client)
              this.syncNavPathSubscriptions(client)
              this.syncCostmapSubscriptions(client)
              this.syncBtLogSubscription(client)
            }
          }
          if (this.shelfJobActive) {
            this.syncJobStatusSubscription(client)
          }
        })

        client.on('serviceCallResponse', (response) => {
          const pending = this.pendingServiceCalls.get(response.callId)
          if (!pending) return
          this.pendingServiceCalls.delete(response.callId)
          pending.resolve(toUint8Array(response.data))
        })

        client.on('serviceCallFailure', (failure) => {
          const pending = this.pendingServiceCalls.get(failure.callId)
          if (!pending) return
          this.pendingServiceCalls.delete(failure.callId)
          pending.reject(new Error(failure.message))
        })

        client.on('message', (event) => {
          if (generation !== this.connectGeneration) return

          if (event.subscriptionId === this.odomSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const pose = decodeOdometry(bytes)
            if (pose) this.onOdom(pose)
            return
          }

          if (
            event.subscriptionId === this.tfSubscriptionId ||
            event.subscriptionId === this.tfStaticSubscriptionId
          ) {
            const bytes = toUint8Array(event.data)
            const transforms = decodeTfMessage(bytes)
            if (!transforms) {
              // decode 失败时 decodeTfMessage 已打一次 warn；此处不再刷屏
              return
            }

            tfRuntimeStore.updateTransforms(transforms)

            // 控制台调试：window.tfDebugCaster = true
            if (typeof window !== 'undefined') {
              const w = window as unknown as { tfDebugCaster?: boolean }
              if (w.tfDebugCaster) {
                const now = performance.now()
                if (now - this.lastTfDebugAt >= TF_DEBUG_THROTTLE_MS) {
                  const childFrames = transforms
                    .map((t) => (t.childFrame.startsWith('/') ? t.childFrame.slice(1) : t.childFrame))
                    .slice(0, TF_DEBUG_LIST_LIMIT)
                  const hit = transforms.find(
                    (t) =>
                      (t.childFrame.startsWith('/') ? t.childFrame.slice(1) : t.childFrame) ===
                      TF_DEBUG_CHILD,
                  )
                  this.lastTfDebugAt = now
                  if (hit) {
                    console.log('[TF:capture]', {
                      parentFrame: hit.parentFrame,
                      childFrame: hit.childFrame,
                      translation: hit.transform.translation,
                      rotation: hit.transform.rotation,
                    })
                  } else {
                    console.log('[TF:miss]', {
                      wantedChildFrame: TF_DEBUG_CHILD,
                      messageTransformCount: transforms.length,
                      sampleChildFrames: childFrames,
                    })
                  }
                }
              }
            }
            return
          }

          for (const sub of this.imageSubs.values()) {
            if (sub.subscriptionId !== event.subscriptionId) continue
            void this.handleImageMessage(sub, event.data)
            return
          }

          for (const sub of this.pointCloudSubs.values()) {
            if (sub.subscriptionId !== event.subscriptionId) continue
            this.handlePointCloudMessage(sub, event.data)
            return
          }

          for (const sub of this.laserScanSubs.values()) {
            if (sub.subscriptionId !== event.subscriptionId) continue
            this.handleLaserScanMessage(sub, event.data)
            return
          }

          for (const sub of this.cameraInfoSubs.values()) {
            if (sub.subscriptionId !== event.subscriptionId) continue
            this.handleCameraInfoMessage(sub, event.data)
            return
          }

          if (event.subscriptionId === this.navFeedbackSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const fb = decodeNavGoalFeedback(bytes)
            if (fb) navGoalStore.applyFeedback(fb)
            return
          }

          if (event.subscriptionId === this.navStatusSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const status = decodeNavGoalStatus(bytes)
            if (status != null) {
              navGoalStore.applyStatus(status)
            }
            return
          }

          if (event.subscriptionId === this.navPlanSmoothedSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const path = decodeNavPath(bytes)
            if (path) navPathStore.setPath(PLAN_SMOOTHED_TOPIC, path)
            return
          }

          if (event.subscriptionId === this.navPlanSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const path = decodeNavPath(bytes)
            if (path) navPathStore.setPath(PLAN_TOPIC, path)
            return
          }

          if (event.subscriptionId === this.navLocalPlanSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const path = decodeNavPath(bytes)
            if (path) navPathStore.setPath(LOCAL_PLAN_TOPIC, path)
            return
          }

          if (event.subscriptionId === this.btLogSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const log = decodeBehaviorTreeLog(bytes)
            if (log) btTimelineStore.applyStatusChanges(log.eventLog)
            return
          }

          if (event.subscriptionId === this.jobStatusSubscriptionId) {
            const bytes = toUint8Array(event.data)
            const status = decodeJobStatus(bytes, this.jobStatusEncoding)
            if (status) shelfJobStore.applyStatus(status)
            return
          }

          for (const [topic, subId] of this.costmapSubscriptionIds) {
            if (event.subscriptionId === subId) {
              const bytes = toUint8Array(event.data)
              const grid = decodeOccupancyGrid(bytes)
              if (grid) costmapStoreByTopic(topic)?.setGrid(grid)
              return
            }
          }
        })

        client.on('error', (err) => {
          this.log({ level: 'error', message: err.message })
        })

        client.on('close', () => {
          this.log({ level: 'warn', message: 'Foxglove 连接已关闭' })
        })

        ws.addEventListener('error', () => {
          finish(() => {
            window.clearTimeout(timeout)
            reject(
              new Error(
                `WebSocket 握手失败。若 foxglove_bridge ≥3.x，需 subprotocol foxglove.sdk.v1；请确认 bridge 在运行`,
              ),
            )
          })
        })

        ws.addEventListener('close', (ev) => {
          if (!settled && ev.code !== 1000) {
            finish(() => {
              window.clearTimeout(timeout)
              reject(new Error(`WebSocket 关闭 code=${ev.code}${ev.reason ? `: ${ev.reason}` : ''}`))
            })
          }
        })
      } catch (err) {
        finish(() => reject(err instanceof Error ? err : new Error(String(err))))
      }
    })
  }

  private syncOdomSubscription(client: FoxgloveClient) {
    if (this.odomSubscriptionId != null) return
    const odom =
      ODOM_TOPIC_CANDIDATES.map((topic) => this.channels.find((c) => c.topic === topic)).find(
        (c): c is Channel => c != null,
      ) ?? this.channels.find((c) => c.schemaName.includes('Odometry'))
    if (!odom) return
    this.odomChannelId = odom.id
    this.odomSubscriptionId = client.subscribe(odom.id)
    this.log({ level: 'info', message: `已订阅 ${odom.topic}` })
  }

  private syncTfSubscription(client: FoxgloveClient) {
    const tf = this.channels.find((c) => c.topic === TF_TOPIC)
    if (tf && this.tfSubscriptionId == null) {
      this.tfSubscriptionId = client.subscribe(tf.id)
      tfRuntimeStore.setActive(true)
      this.log({ level: 'info', message: `已订阅 ${TF_TOPIC}` })
    }
    const tfStatic = this.channels.find((c) => c.topic === TF_STATIC_TOPIC)
    if (tfStatic && this.tfStaticSubscriptionId == null) {
      this.tfStaticSubscriptionId = client.subscribe(tfStatic.id)
      tfRuntimeStore.setActive(true)
      this.log({ level: 'info', message: `已订阅 ${TF_STATIC_TOPIC}（map↔odom）` })
    }
  }

  private syncImageSubscriptions(client: FoxgloveClient) {
    for (const sub of this.imageSubs.values()) {
      if (sub.callbacks.size === 0) continue
      const channel = this.channels.find((c) => c.topic === sub.topic)
      if (!channel) continue
      if (sub.subscriptionId != null) continue
      sub.channelId = channel.id
      sub.schemaName = channel.schemaName
      sub.subscriptionId = client.subscribe(channel.id)
      this.log({ level: 'info', message: `摄像头已订阅 ${sub.topic}` })
    }
  }

  private async handleImageMessage(sub: ImageSubscription, data: ArrayBuffer | ArrayBufferView) {
    const now = performance.now()
    const minInterval = 1000 / IMAGE_UI_MAX_FPS
    if (now - sub.lastFrameAt < minInterval) return
    sub.lastFrameAt = now

    const bytes = toUint8Array(data)
    const { decodeImagePayload } = await import('@/lib/ros/image-decoder')
    const frame = await decodeImagePayload(sub.topic, sub.schemaName, bytes)
    if (!frame) return

    for (const cb of sub.callbacks) {
      cb(sub.topic, frame)
    }
  }

  private syncPointCloudSubscriptions(client: FoxgloveClient) {
    for (const sub of this.pointCloudSubs.values()) {
      if (sub.callbacks.size === 0) continue
      const channel = this.channels.find((c) => c.topic === sub.topic)
      if (!channel) continue
      if (!isLidarPointCloudTopic(channel.topic, channel.schemaName)) {
        this.log({
          level: 'warn',
          message: `跳过非 PointCloud2 话题: ${channel.topic} (${channel.schemaName})`,
        })
        continue
      }
      if (sub.subscriptionId != null) continue
      sub.channelId = channel.id
      sub.schemaName = channel.schemaName
      sub.subscriptionId = client.subscribe(channel.id)
      this.log({ level: 'info', message: `雷达已订阅 ${sub.topic}` })
    }
  }

  private syncLaserScanSubscriptions(client: FoxgloveClient) {
    for (const sub of this.laserScanSubs.values()) {
      if (sub.callbacks.size === 0) continue
      const channel = this.channels.find((c) => c.topic === sub.topic)
      if (!channel) continue
      if (!isLaserScanTopic(channel.topic, channel.schemaName)) {
        this.log({
          level: 'warn',
          message: `跳过非 LaserScan 话题: ${channel.topic} (${channel.schemaName})`,
        })
        continue
      }
      if (sub.subscriptionId != null) continue
      sub.channelId = channel.id
      sub.schemaName = channel.schemaName
      sub.subscriptionId = client.subscribe(channel.id)
      this.log({ level: 'info', message: `LaserScan 已订阅 ${sub.topic}` })
    }
  }

  private handleLaserScanMessage(sub: LaserScanSubscription, data: ArrayBuffer | ArrayBufferView) {
    const bytes = toUint8Array(data)
    const scan = decodeLaserScan(bytes)
    if (!scan) return
    for (const cb of sub.callbacks) {
      cb(sub.topic, scan)
    }
  }

  private syncCameraInfoSubscriptions(client: FoxgloveClient) {
    for (const sub of this.cameraInfoSubs.values()) {
      if (sub.callbacks.size === 0) continue
      const channel = this.channels.find((c) => c.topic === sub.topic)
      if (!channel) continue
      if (!isCameraInfoTopic(channel.topic, channel.schemaName)) {
        this.log({
          level: 'warn',
          message: `跳过非 CameraInfo 话题: ${channel.topic} (${channel.schemaName})`,
        })
        continue
      }
      if (sub.subscriptionId != null) continue
      sub.channelId = channel.id
      sub.schemaName = channel.schemaName
      sub.subscriptionId = client.subscribe(channel.id)
      this.log({ level: 'info', message: `CameraInfo 已订阅 ${sub.topic}` })
    }
  }

  private handleCameraInfoMessage(sub: CameraInfoSubscription, data: ArrayBuffer | ArrayBufferView) {
    const bytes = toUint8Array(data)
    const info = decodeRosCameraInfo(sub.topic, bytes)
    if (!info) return
    for (const cb of sub.callbacks) {
      cb(sub.topic, info)
    }
  }

  private handlePointCloudMessage(sub: PointCloudSubscription, data: ArrayBuffer | ArrayBufferView) {
    const bytes = toUint8Array(data)

    const cloud = decodePointCloud2(bytes)
    if (!cloud) return

    for (const cb of sub.callbacks) {
      cb(sub.topic, cloud)
    }
  }

  onLidarTopicsChanged(listener: TopicsListener) {
    this.lidarTopicListeners.add(listener)
    return () => this.lidarTopicListeners.delete(listener)
  }

  private rebuildLidarTopicCache(): boolean {
    const next = this.channels
      .filter((c) => isLidarPointCloudTopic(c.topic, c.schemaName))
      .map((c) => c.topic)
      .sort()

    const prev = this.cachedLidarTopics
    if (prev.length === next.length && prev.every((t, i) => t === next[i])) {
      return false
    }

    this.cachedLidarTopics = next
    return true
  }

  private notifyLidarTopicListeners() {
    if (!this.rebuildLidarTopicCache()) return
    for (const listener of this.lidarTopicListeners) {
      listener()
    }
  }

  getLidarTopics(): readonly string[] {
    return this.cachedLidarTopics
  }

  subscribePointCloud(topic: string, callback: PointCloudFn): () => void {
    let sub = this.pointCloudSubs.get(topic)
    if (!sub) {
      sub = {
        topic,
        channelId: null,
        subscriptionId: null,
        schemaName: 'sensor_msgs/msg/PointCloud2',
        callbacks: new Set(),
      }
      this.pointCloudSubs.set(topic, sub)
    }

    sub.callbacks.add(callback)

    if (this.client) {
      const channel = this.channels.find((c) => c.topic === topic)
      if (channel && sub.subscriptionId == null) {
        if (!isLidarPointCloudTopic(channel.topic, channel.schemaName)) {
          this.log({
            level: 'warn',
            message: `跳过非 PointCloud2 话题: ${topic} (${channel.schemaName})`,
          })
        } else {
          sub.channelId = channel.id
          sub.schemaName = channel.schemaName
          sub.subscriptionId = this.client.subscribe(channel.id)
          this.log({ level: 'info', message: `雷达已订阅 ${topic}` })
        }
      }
    }

    return () => {
      const current = this.pointCloudSubs.get(topic)
      if (!current) return
      current.callbacks.delete(callback)
      if (current.callbacks.size === 0) {
        if (this.client && current.subscriptionId != null) {
          this.client.unsubscribe(current.subscriptionId)
        }
        this.pointCloudSubs.delete(topic)
      }
    }
  }

  subscribeLaserScan(topic: string, callback: LaserScanFn): () => void {
    let sub = this.laserScanSubs.get(topic)
    if (!sub) {
      sub = {
        topic,
        channelId: null,
        subscriptionId: null,
        schemaName: 'sensor_msgs/msg/LaserScan',
        callbacks: new Set(),
      }
      this.laserScanSubs.set(topic, sub)
    }

    sub.callbacks.add(callback)

    if (this.client) {
      const channel = this.channels.find((c) => c.topic === topic)
      if (channel && sub.subscriptionId == null) {
        if (!isLaserScanTopic(channel.topic, channel.schemaName)) {
          this.log({
            level: 'warn',
            message: `跳过非 LaserScan 话题: ${topic} (${channel.schemaName})`,
          })
        } else {
          sub.channelId = channel.id
          sub.schemaName = channel.schemaName
          sub.subscriptionId = this.client.subscribe(channel.id)
          this.log({ level: 'info', message: `LaserScan 已订阅 ${topic}` })
        }
      }
    }

    return () => {
      const current = this.laserScanSubs.get(topic)
      if (!current) return
      current.callbacks.delete(callback)
      if (current.callbacks.size === 0) {
        if (this.client && current.subscriptionId != null) {
          this.client.unsubscribe(current.subscriptionId)
        }
        this.laserScanSubs.delete(topic)
      }
    }
  }

  subscribeCameraInfo(topic: string, callback: CameraInfoFn): () => void {
    let sub = this.cameraInfoSubs.get(topic)
    if (!sub) {
      sub = {
        topic,
        channelId: null,
        subscriptionId: null,
        schemaName: 'sensor_msgs/msg/CameraInfo',
        callbacks: new Set(),
      }
      this.cameraInfoSubs.set(topic, sub)
    }

    sub.callbacks.add(callback)

    if (this.client) {
      const channel = this.channels.find((c) => c.topic === topic)
      if (channel && sub.subscriptionId == null) {
        if (!isCameraInfoTopic(channel.topic, channel.schemaName)) {
          this.log({
            level: 'warn',
            message: `跳过非 CameraInfo 话题: ${topic} (${channel.schemaName})`,
          })
        } else {
          sub.channelId = channel.id
          sub.schemaName = channel.schemaName
          sub.subscriptionId = this.client.subscribe(channel.id)
          this.log({ level: 'info', message: `CameraInfo 已订阅 ${topic}` })
        }
      }
    }

    return () => {
      const current = this.cameraInfoSubs.get(topic)
      if (!current) return
      current.callbacks.delete(callback)
      if (current.callbacks.size === 0) {
        if (this.client && current.subscriptionId != null) {
          this.client.unsubscribe(current.subscriptionId)
        }
        this.cameraInfoSubs.delete(topic)
      }
    }
  }

  onTopicsChanged(listener: TopicsListener) {
    this.topicListeners.add(listener)
    return () => this.topicListeners.delete(listener)
  }

  /** Full channel list changes (Topics panel — live + shared with MCAP shape) */
  onChannelsChanged(listener: TopicsListener) {
    this.channelListeners.add(listener)
    return () => this.channelListeners.delete(listener)
  }

  private rebuildTopicInfoCache(): boolean {
    const next: McapTopicInfo[] = this.channels
      .map((c) => ({
        topic: c.topic,
        schemaName: c.schemaName,
        channelId: c.id,
        messageEncoding: c.encoding,
        schemaId: 0,
      }))
      .sort((a, b) => a.topic.localeCompare(b.topic))

    const prev = this.cachedTopicInfos
    if (
      prev.length === next.length &&
      prev.every(
        (p, i) =>
          p.topic === next[i].topic &&
          p.schemaName === next[i].schemaName &&
          p.channelId === next[i].channelId,
      )
    ) {
      return false
    }
    this.cachedTopicInfos = next
    return true
  }

  private notifyChannelListeners() {
    this.rebuildTopicInfoCache()
    for (const listener of this.channelListeners) {
      listener()
    }
  }

  getTopicInfos(): readonly McapTopicInfo[] {
    return this.cachedTopicInfos
  }

  private rebuildCameraTopicCache(): boolean {
    const next = preferCompressedCameraTopics(
      this.channels
        .filter((c) => isCameraImageTopic(c.topic, c.schemaName))
        .map((c) => c.topic),
    )

    const prev = this.cachedCameraTopics
    if (prev.length === next.length && prev.every((t, i) => t === next[i])) {
      return false
    }

    this.cachedCameraTopics = next
    return true
  }

  private notifyTopicListeners() {
    if (!this.rebuildCameraTopicCache()) return
    for (const listener of this.topicListeners) {
      listener()
    }
  }

  /** 列出 Bridge 上所有 camera / image_raw 相关话题（稳定引用，供 useSyncExternalStore） */
  getCameraImageTopics(): readonly string[] {
    return this.cachedCameraTopics
  }

  getAllTopics(): string[] {
    return this.channels.map((c) => c.topic).sort()
  }

  subscribeImage(topic: string, callback: ImageFrameFn): () => void {
    let sub = this.imageSubs.get(topic)
    if (!sub) {
      sub = {
        topic,
        channelId: null,
        subscriptionId: null,
        schemaName: 'sensor_msgs/msg/CompressedImage',
        callbacks: new Set(),
        lastFrameAt: 0,
      }
      this.imageSubs.set(topic, sub)
    }

    sub.callbacks.add(callback)

    if (this.client) {
      const channel = this.channels.find((c) => c.topic === topic)
      if (channel && sub.subscriptionId == null) {
        sub.channelId = channel.id
        sub.schemaName = channel.schemaName
        sub.subscriptionId = this.client.subscribe(channel.id)
        this.log({ level: 'info', message: `摄像头已订阅 ${topic}` })
      }
    }

    return () => {
      const current = this.imageSubs.get(topic)
      if (!current) return
      current.callbacks.delete(callback)
      if (current.callbacks.size === 0) {
        if (this.client && current.subscriptionId != null) {
          this.client.unsubscribe(current.subscriptionId)
        }
        this.imageSubs.delete(topic)
        releaseH264Decoder(topic)
      }
    }
  }

  private cleanupSocket() {
    if (this.client) {
      try {
        this.client.close()
      } catch {
        /* ignore */
      }
    }
    this.client = null
    this.ws = null
    this.cmdVelChannelId = null
    this.odomSubscriptionId = null
    this.odomChannelId = null
    this.tfSubscriptionId = null
    this.tfStaticSubscriptionId = null
    this.clientPublishEnabled = false
    this.servicesEnabled = false
    this.channels = []
    this.channelsById.clear()
    this.cachedTopicInfos = []
    this.services = []
    this.servicesById.clear()
    this.pendingServiceCalls.clear()
    this.navFeedbackSubscriptionId = null
    this.navStatusSubscriptionId = null
    this.navPlanSmoothedSubscriptionId = null
    this.navPlanSubscriptionId = null
    this.navLocalPlanSubscriptionId = null
    this.btLogSubscriptionId = null
    this.jobStatusSubscriptionId = null
    for (const sub of this.imageSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.pointCloudSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.laserScanSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.cameraInfoSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
  }

  /** 差速驱动控制器：advertise /cmd_vel */
  advertiseCmdVel(): boolean {
    if (!this.client || this.cmdVelChannelId != null) return this.cmdVelChannelId != null
    if (!this.clientPublishEnabled) {
      this.log({ level: 'warn', message: '无法 advertise /cmd_vel：Bridge 未开启 clientPublish' })
      return false
    }
    this.cmdVelChannelId = this.client.advertise({
      topic: CMD_VEL_TOPIC,
      encoding: 'cdr',
      schemaName: 'geometry_msgs/msg/Twist',
    })
    this.log({ level: 'info', message: `差速驱动控制器已 advertise ${CMD_VEL_TOPIC}` })
    return true
  }

  unadvertiseCmdVel() {
    if (!this.client || this.cmdVelChannelId == null) return
    this.client.unadvertise(this.cmdVelChannelId)
    this.cmdVelChannelId = null
  }

  publishCmdVel(cmd: CmdVel) {
    if (!this.client || this.cmdVelChannelId == null) return
    const data = encodeTwist(cmd)
    this.client.sendMessage(this.cmdVelChannelId, data)
  }

  isCmdVelAdvertised() {
    return this.cmdVelChannelId != null
  }

  /** Nav Goal 面板：订阅 feedback/status 并跟踪桥接 service */
  enableNavGoalTracking(active: boolean) {
    this.navGoalActive = active
    this.ensureCostmapVisibilityHooks()
    if (!this.client) {
      if (!active) {
        navGoalStore.setServicesReady(false)
        this.unsubscribeAllCostmaps()
        btTimelineStore.reset()
      }
      return
    }
    if (active) {
      this.syncNavGoalSubscriptions(this.client)
      this.syncNavPathSubscriptions(this.client)
      this.syncCostmapSubscriptions(this.client)
      this.syncBtLogSubscription(this.client)
    } else {
      this.unsubscribeNavGoalTopics()
      this.unsubscribeAllCostmaps()
      btTimelineStore.reset()
      navGoalStore.setServicesReady(false)
      navPathStore.reset()
    }
  }

  /** 货架作业面板：订阅 /job/status 并跟踪 /job/start、/job/cancel */
  enableShelfJobTracking(active: boolean) {
    this.shelfJobActive = active
    if (!this.client) {
      if (!active) {
        shelfJobStore.setServicesReady(false)
        shelfJobStore.setSubscribed(false)
      }
      return
    }
    if (active) {
      this.refreshShelfJobServices()
      this.syncJobStatusSubscription(this.client)
    } else {
      this.unsubscribeJobStatus()
      shelfJobStore.setServicesReady(false)
      shelfJobStore.setSubscribed(false)
    }
  }

  private refreshShelfJobServices() {
    const hasStart = this.services.some((s) => s.name === JOB_START_SERVICE)
    const hasCancel = this.services.some((s) => s.name === JOB_CANCEL_SERVICE)
    const ready = hasStart && hasCancel
    if (ready && !shelfJobStore.servicesReady) {
      this.log({ level: 'info', message: '货架作业服务已发现 (/job/start, /job/cancel)' })
    }
    shelfJobStore.setServicesReady(ready)
  }

  private findJobStatusChannel(): Channel | undefined {
    const exact = this.channels.find((c) => {
      const topic = c.topic.startsWith('/') ? c.topic : `/${c.topic}`
      return topic === JOB_STATUS_TOPIC || topic.endsWith('/job/status')
    })
    if (exact) return exact
    return this.channels.find((c) => /JobStatus/i.test(c.schemaName))
  }

  private syncJobStatusSubscription(client: FoxgloveClient) {
    const channel = this.findJobStatusChannel()
    if (channel && this.jobStatusSubscriptionId == null) {
      this.jobStatusEncoding = channel.encoding || 'cdr'
      this.jobStatusSubscriptionId = client.subscribe(channel.id)
      shelfJobStore.setSubscribed(true)
      this.log({
        level: 'info',
        message: `已订阅 ${channel.topic} (${channel.schemaName}, ${this.jobStatusEncoding})`,
      })
      return
    }
    shelfJobStore.setSubscribed(this.jobStatusSubscriptionId != null)
  }

  private unsubscribeJobStatus() {
    if (this.client && this.jobStatusSubscriptionId != null) {
      this.client.unsubscribe(this.jobStatusSubscriptionId)
    }
    this.jobStatusSubscriptionId = null
    shelfJobStore.setSubscribed(false)
  }

  private ensureCostmapVisibilityHooks() {
    if (this.costmapHooksBound) return
    this.costmapHooksBound = true
    for (const store of costmapStores) {
      const unsub = store.onVisibilityChange((visible) => {
        if (!this.client || !this.navGoalActive) {
          if (!visible) this.unsubscribeCostmap(store)
          return
        }
        if (visible) this.syncCostmapSubscription(this.client, store)
        else this.unsubscribeCostmap(store)
      })
      this.costmapVisibilityUnsubs.push(unsub)
    }
  }

  private syncNavGoalSubscriptions(client: FoxgloveClient) {
    const feedback = this.channels.find((c) => c.topic === NAV_FEEDBACK_TOPIC)
    if (feedback && this.navFeedbackSubscriptionId == null) {
      this.navFeedbackSubscriptionId = client.subscribe(feedback.id)
      this.log({ level: 'info', message: `已订阅 ${NAV_FEEDBACK_TOPIC}` })
    }
    const status = this.channels.find((c) => c.topic === NAV_STATUS_TOPIC)
    if (status && this.navStatusSubscriptionId == null) {
      this.navStatusSubscriptionId = client.subscribe(status.id)
      this.log({ level: 'info', message: `已订阅 ${NAV_STATUS_TOPIC}` })
    }
  }

  /** Nav Goal 面板打开时订阅 Nav2 路径（经 Foxglove，与 web_nav_bridge 无关） */
  private syncNavPathSubscriptions(client: FoxgloveClient) {
    const smoothed = this.channels.find((c) => c.topic === PLAN_SMOOTHED_TOPIC)
    if (smoothed && this.navPlanSmoothedSubscriptionId == null) {
      this.navPlanSmoothedSubscriptionId = client.subscribe(smoothed.id)
      this.log({ level: 'info', message: `已订阅 ${PLAN_SMOOTHED_TOPIC}` })
    }

    const plan = this.channels.find((c) => c.topic === PLAN_TOPIC)
    if (plan && this.navPlanSubscriptionId == null) {
      this.navPlanSubscriptionId = client.subscribe(plan.id)
      this.log({ level: 'info', message: `已订阅 ${PLAN_TOPIC}` })
    }

    const local = this.channels.find((c) => c.topic === LOCAL_PLAN_TOPIC)
    if (local && this.navLocalPlanSubscriptionId == null) {
      this.navLocalPlanSubscriptionId = client.subscribe(local.id)
      this.log({ level: 'info', message: `已订阅 ${LOCAL_PLAN_TOPIC}` })
    }
  }

  /** Nav Goal 面板：订阅 Nav2 行为树事件日志 */
  private syncBtLogSubscription(client: FoxgloveClient) {
    const channel =
      this.channels.find((c) => c.topic === BT_LOG_TOPIC) ??
      this.channels.find((c) => c.topic.endsWith('/behavior_tree_log'))
    if (channel && this.btLogSubscriptionId == null) {
      this.btLogSubscriptionId = client.subscribe(channel.id)
      btTimelineStore.setSubscribed(true)
      this.log({ level: 'info', message: `已订阅 ${channel.topic}（BT 决策时间线）` })
      return
    }
    btTimelineStore.setSubscribed(this.btLogSubscriptionId != null)
  }

  /** 面板开关打开时才订阅对应 costmap（带宽较大） */
  private syncCostmapSubscriptions(client: FoxgloveClient) {
    for (const store of costmapStores) {
      if (store.visible) this.syncCostmapSubscription(client, store)
      else this.unsubscribeCostmap(store)
    }
  }

  private syncCostmapSubscription(client: FoxgloveClient, store: CostmapStore) {
    if (!store.visible) {
      this.unsubscribeCostmap(store)
      return
    }
    // 已有活动订阅时，即使某批 advertise 暂时不含该频道也不要退订/翻转状态
    if (this.costmapSubscriptionIds.has(store.topic)) {
      store.setSubscribed(true)
      return
    }
    const channel = this.channels.find((c) => c.topic === store.topic)
    if (!channel) {
      store.setSubscribed(false)
      return
    }
    this.costmapSubscriptionIds.set(store.topic, client.subscribe(channel.id))
    store.setSubscribed(true)
    this.log({ level: 'info', message: `已订阅 ${store.topic}` })
  }

  private unsubscribeCostmap(store: CostmapStore) {
    const subId = this.costmapSubscriptionIds.get(store.topic)
    if (this.client && subId != null) {
      this.client.unsubscribe(subId)
    }
    this.costmapSubscriptionIds.delete(store.topic)
    store.setSubscribed(false)
    store.clearGrid()
  }

  private unsubscribeAllCostmaps() {
    for (const store of costmapStores) {
      this.unsubscribeCostmap(store)
    }
  }

  private unsubscribeNavGoalTopics() {
    if (!this.client) return
    if (this.navFeedbackSubscriptionId != null) {
      this.client.unsubscribe(this.navFeedbackSubscriptionId)
      this.navFeedbackSubscriptionId = null
    }
    if (this.navStatusSubscriptionId != null) {
      this.client.unsubscribe(this.navStatusSubscriptionId)
      this.navStatusSubscriptionId = null
    }
    if (this.navPlanSmoothedSubscriptionId != null) {
      this.client.unsubscribe(this.navPlanSmoothedSubscriptionId)
      this.navPlanSmoothedSubscriptionId = null
    }
    if (this.navPlanSubscriptionId != null) {
      this.client.unsubscribe(this.navPlanSubscriptionId)
      this.navPlanSubscriptionId = null
    }
    if (this.navLocalPlanSubscriptionId != null) {
      this.client.unsubscribe(this.navLocalPlanSubscriptionId)
      this.navLocalPlanSubscriptionId = null
    }
    if (this.btLogSubscriptionId != null) {
      this.client.unsubscribe(this.btLogSubscriptionId)
      this.btLogSubscriptionId = null
    }
    btTimelineStore.setSubscribed(false)
    navPathStore.reset()
  }

  private findService(name: string): Service | undefined {
    return this.services.find((s) => s.name === name)
  }

  private callService(serviceName: string, data: Uint8Array, timeoutMs = 15000): Promise<Uint8Array> {
    if (!this.client || !this.servicesEnabled) {
      return Promise.reject(new Error('Foxglove Bridge 未开启 services capability'))
    }
    const service = this.findService(serviceName)
    if (!service) {
      return Promise.reject(new Error(`服务未找到: ${serviceName}`))
    }
    const callId = this.nextServiceCallId++
    return new Promise((resolve, reject) => {
      this.pendingServiceCalls.set(callId, { resolve, reject })
      this.client!.sendServiceCallRequest({
        serviceId: service.id,
        callId,
        encoding: 'cdr',
        data,
      })
      window.setTimeout(() => {
        if (!this.pendingServiceCalls.has(callId)) return
        this.pendingServiceCalls.delete(callId)
        reject(new Error(`服务调用超时: ${serviceName}`))
      }, timeoutMs)
    })
  }

  async sendNavigateToPose(pose: RosPoseStamped): Promise<{ success: boolean; message: string }> {
    navGoalStore.beginNewGoal('正在发送导航目标…')
    navPathStore.reset()
    btTimelineStore.beginMission()
    try {
      const data = await this.callService(NAV_GOAL_SERVICE, encodeNavigateToPoseRequest(pose))
      const decoded = decodeBoolStringResponse(data)
      if (!decoded) throw new Error('无法解析服务响应')
      if (decoded.success) {
        navGoalStore.setMessage(decoded.message)
        // 阶段由 /navigate_to_pose/_action/status 驱动，勿在此硬编码 EXECUTING(2)
      } else {
        // Service may report failure while action still runs; status topic overrides later.
        navGoalStore.setMessage(decoded.message)
      }
      return decoded
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      navGoalStore.setFailed(message)
      throw err
    }
  }

  async cancelNavigation(): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.callService(NAV_CANCEL_SERVICE, encodeEmptyServiceRequest())
      const decoded = decodeBoolStringResponse(data)
      if (!decoded) throw new Error('无法解析服务响应')
      if (decoded.success) {
        navGoalStore.applyStatus(5)
        navGoalStore.setMessage(decoded.message)
      } else {
        navGoalStore.setFailed(decoded.message)
      }
      return decoded
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      navGoalStore.setFailed(message)
      throw err
    }
  }

  async startShelfJob(req: StartJobRequest): Promise<{ accepted: boolean; message: string }> {
    shelfJobStore.beginStart('正在启动作业…')
    try {
      const data = await this.callService(JOB_START_SERVICE, encodeStartJobRequest(req), 5000)
      const decoded = decodeStartJobResponse(data)
      if (!decoded) throw new Error('无法解析 /job/start 响应')
      shelfJobStore.applyStartResponse(decoded.accepted, decoded.message)
      return decoded
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      shelfJobStore.setFailed(message)
      throw err
    }
  }

  async cancelShelfJob(): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.callService(JOB_CANCEL_SERVICE, encodeEmptyServiceRequest(), 5000)
      const decoded = decodeBoolStringResponse(data)
      if (!decoded) throw new Error('无法解析 /job/cancel 响应')
      if (!decoded.success) {
        shelfJobStore.setFailed(decoded.message)
      } else {
        shelfJobStore.setMessage(decoded.message)
      }
      return decoded
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      shelfJobStore.setFailed(message)
      throw err
    }
  }

  getConnectedUrl() {
    return this.connectedUrl
  }

  disconnect() {
    this.connectGeneration++
    if (this.client) {
      if (this.odomSubscriptionId != null) {
        this.client.unsubscribe(this.odomSubscriptionId)
      }
      if (this.tfSubscriptionId != null) {
        this.client.unsubscribe(this.tfSubscriptionId)
      }
      if (this.tfStaticSubscriptionId != null) {
        this.client.unsubscribe(this.tfStaticSubscriptionId)
      }
      for (const sub of this.imageSubs.values()) {
        if (sub.subscriptionId != null) {
          this.client.unsubscribe(sub.subscriptionId)
        }
      }
      for (const sub of this.pointCloudSubs.values()) {
        if (sub.subscriptionId != null) {
          this.client.unsubscribe(sub.subscriptionId)
        }
      }
      for (const sub of this.laserScanSubs.values()) {
        if (sub.subscriptionId != null) {
          this.client.unsubscribe(sub.subscriptionId)
        }
      }
      for (const sub of this.cameraInfoSubs.values()) {
        if (sub.subscriptionId != null) {
          this.client.unsubscribe(sub.subscriptionId)
        }
      }
      this.unsubscribeNavGoalTopics()
      this.unsubscribeJobStatus()
      this.unsubscribeAllCostmaps()
      if (this.cmdVelChannelId != null) {
        this.client.unadvertise(this.cmdVelChannelId)
      }
      this.client.close()
    }
    this.client = null
    this.ws = null
    this.connectedUrl = null
    this.cmdVelChannelId = null
    this.odomSubscriptionId = null
    this.odomChannelId = null
    this.tfSubscriptionId = null
    this.tfStaticSubscriptionId = null
    this.clientPublishEnabled = false
    this.servicesEnabled = false
    this.channels = []
    this.channelsById.clear()
    this.services = []
    this.servicesById.clear()
    this.pendingServiceCalls.clear()
    this.costmapSubscriptionIds.clear()
    this.jobStatusSubscriptionId = null
    navPathStore.reset()
    btTimelineStore.reset()
    shelfJobStore.reset()
    for (const store of costmapStores) {
      store.setSubscribed(false)
      store.clearGrid()
    }
    tfRuntimeStore.reset()
    releaseAllH264Decoders()
    for (const sub of this.imageSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.pointCloudSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    this.cachedTopicInfos = []
    this.notifyTopicListeners()
    this.notifyLidarTopicListeners()
    this.notifyChannelListeners()
  }

  isConnected() {
    return this.client != null && this.ws?.readyState === WebSocket.OPEN
  }
}

export const foxgloveManager = new FoxgloveBridgeManager()
