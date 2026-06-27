import { FoxgloveClient } from '@foxglove/ws-protocol'
import type { Channel, ClientChannelId, SubscriptionId } from '@foxglove/ws-protocol'
import {
  encodeTwist,
  decodeOdometry,
  decodeImageMessage,
  decodePointCloud2,
  isCameraImageTopic,
  isLidarPointCloudTopic,
  preferCompressedCameraTopics,
  type CmdVel,
  type DecodedCameraFrame,
  type DecodedPointCloud,
} from '@/lib/foxglove/ros-serialization'
import { FOXGLOVE_WS_CANDIDATES, FOXGLOVE_WS_SUBPROTOCOLS } from '@/lib/ros/foxglove-config'
import {
  CMD_VEL_TOPIC,
  ODOM_TOPIC,
  type SimulateLogEntry,
} from '@/lib/ros/atoms'

type LogFn = (entry: Omit<SimulateLogEntry, 'id' | 'time'>) => void
type OdomFn = (pose: ReturnType<typeof decodeOdometry>) => void
type ImageFrameFn = (topic: string, frame: DecodedCameraFrame) => void
type PointCloudFn = (topic: string, cloud: DecodedPointCloud) => void
type TopicsListener = () => void

const EMPTY_CAMERA_TOPICS: readonly string[] = []
const EMPTY_LIDAR_TOPICS: readonly string[] = []

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

const IMAGE_UI_MAX_FPS = 30

class FoxgloveBridgeManager {
  private client: FoxgloveClient | null = null
  private ws: WebSocket | null = null
  private connectedUrl: string | null = null
  private cmdVelChannelId: ClientChannelId | null = null
  private odomSubscriptionId: SubscriptionId | null = null
  private odomChannelId: number | null = null
  private clientPublishEnabled = false
  private connectGeneration = 0
  private log: LogFn = () => {}
  private onOdom: OdomFn = () => {}
  private channels: Channel[] = []
  private cachedCameraTopics: readonly string[] = EMPTY_CAMERA_TOPICS
  private cachedLidarTopics: readonly string[] = EMPTY_LIDAR_TOPICS
  private imageSubs = new Map<string, ImageSubscription>()
  private pointCloudSubs = new Map<string, PointCloudSubscription>()
  private topicListeners = new Set<TopicsListener>()
  private lidarTopicListeners = new Set<TopicsListener>()

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
          this.channels = channels
          this.notifyTopicListeners()
          this.notifyLidarTopicListeners()
          this.syncOdomSubscription(client)
          this.syncImageSubscriptions(client)
          this.syncPointCloudSubscriptions(client)
        })

        client.on('message', (event) => {
          if (generation !== this.connectGeneration) return

          if (event.subscriptionId === this.odomSubscriptionId) {
            const bytes =
              event.data instanceof Uint8Array
                ? event.data
                : new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength)
            const pose = decodeOdometry(bytes)
            if (pose) this.onOdom(pose)
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
    const odom = this.channels.find((c) => c.topic === ODOM_TOPIC)
    if (odom && this.odomSubscriptionId == null) {
      this.odomChannelId = odom.id
      this.odomSubscriptionId = client.subscribe(odom.id)
      this.log({ level: 'info', message: `已订阅 ${ODOM_TOPIC}` })
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

    const bytes =
      data instanceof Uint8Array
        ? data
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

    const decoded = await decodeImageMessage(bytes, sub.schemaName)
    if (!decoded?.blobUrl) return

    const frame: DecodedCameraFrame = decoded
    for (const cb of sub.callbacks) {
      cb(sub.topic, frame)
    }
  }

  private syncPointCloudSubscriptions(client: FoxgloveClient) {
    for (const sub of this.pointCloudSubs.values()) {
      if (sub.callbacks.size === 0) continue
      const channel = this.channels.find((c) => c.topic === sub.topic)
      if (!channel) continue
      if (sub.subscriptionId != null) continue
      sub.channelId = channel.id
      sub.schemaName = channel.schemaName
      sub.subscriptionId = client.subscribe(channel.id)
      this.log({ level: 'info', message: `雷达已订阅 ${sub.topic}` })
    }
  }

  private handlePointCloudMessage(sub: PointCloudSubscription, data: ArrayBuffer | ArrayBufferView) {
    const bytes =
      data instanceof Uint8Array
        ? data
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

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
        sub.channelId = channel.id
        sub.schemaName = channel.schemaName
        sub.subscriptionId = this.client.subscribe(channel.id)
        this.log({ level: 'info', message: `雷达已订阅 ${topic}` })
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

  onTopicsChanged(listener: TopicsListener) {
    this.topicListeners.add(listener)
    return () => this.topicListeners.delete(listener)
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
        schemaName: 'sensor_msgs/msg/Image',
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
    this.clientPublishEnabled = false
    this.channels = []
    for (const sub of this.imageSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.pointCloudSubs.values()) {
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

  getConnectedUrl() {
    return this.connectedUrl
  }

  disconnect() {
    this.connectGeneration++
    if (this.client) {
      if (this.odomSubscriptionId != null) {
        this.client.unsubscribe(this.odomSubscriptionId)
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
    this.clientPublishEnabled = false
    this.channels = []
    for (const sub of this.imageSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    for (const sub of this.pointCloudSubs.values()) {
      sub.channelId = null
      sub.subscriptionId = null
    }
    this.notifyTopicListeners()
    this.notifyLidarTopicListeners()
  }

  isConnected() {
    return this.client != null && this.ws?.readyState === WebSocket.OPEN
  }
}

export const foxgloveManager = new FoxgloveBridgeManager()
