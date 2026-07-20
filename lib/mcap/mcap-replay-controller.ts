import type { McapIndexedReader } from '@mcap/core'
import type { DecodedCameraFrame, DecodedPointCloud, OdomMessage } from '@/lib/foxglove/ros-serialization'
import { dispatchMcapMessage } from '@/lib/ros/message-dispatcher'
import { resetImageDecoderForSeek } from '@/lib/ros/image-decoder'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'
import type { McapTopicInfo } from '@/lib/playback/atoms'

type ImageFrameFn = (topic: string, frame: DecodedCameraFrame) => void
type PointCloudFn = (topic: string, cloud: DecodedPointCloud) => void
type OdomFn = (pose: OdomMessage) => void

interface ChannelMeta {
  topic: string
  schemaName: string
  messageEncoding: string
  schemaId: number
}

class McapReplayController {
  private reader: McapIndexedReader | null = null
  private channels = new Map<number, ChannelMeta>()
  private startTimeNs = BigInt(0)
  private endTimeNs = BigInt(0)
  private lastFlushTimeNs = BigInt(0)
  private imageSubs = new Map<string, Set<ImageFrameFn>>()
  private pointCloudSubs = new Map<string, Set<PointCloudFn>>()
  private onOdom: OdomFn | null = null
  private flushing = false
  private flushQueued: bigint | null = null

  get isLoaded(): boolean {
    return this.reader != null
  }

  get timeRange(): { startNs: bigint; endNs: bigint } | null {
    if (!this.reader) return null
    return { startNs: this.startTimeNs, endNs: this.endTimeNs }
  }

  load(result: {
    reader: McapIndexedReader
    topics: McapTopicInfo[]
    startTimeNs: bigint
    endTimeNs: bigint
  }) {
    this.close()
    this.reader = result.reader
    this.startTimeNs = result.startTimeNs
    this.endTimeNs = result.endTimeNs
    this.lastFlushTimeNs = result.startTimeNs
    protobufRegistry.loadFromReader(result.reader)
    for (const t of result.topics) {
      this.channels.set(t.channelId, {
        topic: t.topic,
        schemaName: t.schemaName,
        messageEncoding: t.messageEncoding,
        schemaId: t.schemaId,
      })
    }
  }

  close() {
    this.reader = null
    this.channels.clear()
    this.lastFlushTimeNs = BigInt(0)
    protobufRegistry.reset()
    for (const topic of this.imageSubs.keys()) {
      resetImageDecoderForSeek(topic)
    }
  }

  setOdomHandler(handler: OdomFn | null) {
    this.onOdom = handler
  }

  subscribeImage(topic: string, callback: ImageFrameFn): () => void {
    let set = this.imageSubs.get(topic)
    const isNewTopic = !set
    if (!set) {
      set = new Set()
      this.imageSubs.set(topic, set)
    }
    set.add(callback)
    if (isNewTopic) this.reflushAfterSubscribe()
    return () => {
      const current = this.imageSubs.get(topic)
      if (!current) return
      current.delete(callback)
      if (current.size === 0) this.imageSubs.delete(topic)
    }
  }

  subscribePointCloud(topic: string, callback: PointCloudFn): () => void {
    let set = this.pointCloudSubs.get(topic)
    const isNewTopic = !set
    if (!set) {
      set = new Set()
      this.pointCloudSubs.set(topic, set)
    }
    set.add(callback)
    if (isNewTopic) this.reflushAfterSubscribe()
    return () => {
      const current = this.pointCloudSubs.get(topic)
      if (!current) return
      current.delete(callback)
      if (current.size === 0) this.pointCloudSubs.delete(topic)
    }
  }

  private reflushAfterSubscribe() {
    if (!this.reader || this.lastFlushTimeNs === BigInt(0)) return
    void this.flushToTime(this.lastFlushTimeNs, true)
  }

  private isTopicSubscribed(topic: string, schemaName: string, messageEncoding: string): boolean {
    if (schemaName.includes('TFMessage') || schemaName === 'foxglove.FrameTransform') return true
    if (schemaName.includes('Odometry') && this.onOdom) return true
    if (this.imageSubs.has(topic) || this.pointCloudSubs.has(topic)) return true
    if (messageEncoding === 'protobuf' && schemaName.includes('PointCloud')) {
      return this.pointCloudSubs.size > 0
    }
    return false
  }

  private isSensorMessage(schemaName: string, messageEncoding: string): boolean {
    if (messageEncoding === 'protobuf') {
      return (
        schemaName.includes('PointCloud') ||
        schemaName.includes('CompressedImage')
      )
    }
    return (
      schemaName.includes('PointCloud2') ||
      schemaName.includes('CompressedImage') ||
      schemaName.includes('/Image')
    )
  }

  async seek(timeNs: bigint) {
    this.lastFlushTimeNs = this.startTimeNs
    for (const topic of this.imageSubs.keys()) {
      resetImageDecoderForSeek(topic)
    }
    await this.flushToTime(timeNs, true)
  }

  async flushToTime(timeNs: bigint, isSeek = false) {
    if (!this.reader) return

    if (this.flushing) {
      this.flushQueued = timeNs
      return
    }

    this.flushing = true
    try {
      const clamped =
        timeNs < this.startTimeNs
          ? this.startTimeNs
          : timeNs > this.endTimeNs
            ? this.endTimeNs
            : timeNs

      const fromNs = isSeek || clamped < this.lastFlushTimeNs ? this.startTimeNs : this.lastFlushTimeNs

      const latestSensor = new Map<
        string,
        { schemaName: string; messageEncoding: string; schemaId: number; data: Uint8Array }
      >()
      const handlers = {
        onOdom: this.onOdom ?? undefined,
        onImage: (topic: string, frame: DecodedCameraFrame) => {
          for (const cb of this.imageSubs.get(topic) ?? []) cb(topic, frame)
        },
        onPointCloud: (topic: string, cloud: DecodedPointCloud) => {
          for (const cb of this.pointCloudSubs.get(topic) ?? []) cb(topic, cloud)
        },
      }

      for await (const msg of this.reader.readMessages({
        startTime: fromNs,
        endTime: clamped,
      })) {
        const meta = this.channels.get(msg.channelId)
        if (!meta) continue
        if (!this.isTopicSubscribed(meta.topic, meta.schemaName, meta.messageEncoding)) continue

        const data = msg.data

        if (this.isSensorMessage(meta.schemaName, meta.messageEncoding)) {
          latestSensor.set(meta.topic, {
            schemaName: meta.schemaName,
            messageEncoding: meta.messageEncoding,
            schemaId: meta.schemaId,
            data,
          })
          continue
        }

        await dispatchMcapMessage({
          topic: meta.topic,
          schemaName: meta.schemaName,
          messageEncoding: meta.messageEncoding,
          schemaId: meta.schemaId,
          data,
          handlers,
        })
      }

      for (const [topic, payload] of latestSensor) {
        await dispatchMcapMessage({
          topic,
          schemaName: payload.schemaName,
          messageEncoding: payload.messageEncoding,
          schemaId: payload.schemaId,
          data: payload.data,
          handlers,
        })
      }

      this.lastFlushTimeNs = clamped

      while (this.flushQueued != null) {
        const next = this.flushQueued
        this.flushQueued = null
        if (next !== clamped) {
          await this.flushToTime(next, next < this.lastFlushTimeNs)
        }
      }
    } finally {
      this.flushing = false
    }
  }
}

export const mcapReplayController = new McapReplayController()
