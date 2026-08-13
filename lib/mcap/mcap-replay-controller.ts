import type { McapIndexedReader } from '@mcap/core'
import {
  decodeOdometry,
  decodeTfMessage,
  type DecodedCameraFrame,
  type DecodedLaserScan,
  type DecodedPointCloud,
  type DecodedTfTransform,
  type OdomMessage,
} from '@/lib/foxglove/ros-serialization'
import { dispatchMcapMessage } from '@/lib/ros/message-dispatcher'
import { resetImageDecoderForSeek } from '@/lib/ros/image-decoder'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'
import {
  decodeFoxgloveFrameTransform,
  decodeFoxglovePoseInFrame,
} from '@/lib/mcap/foxglove-protobuf-decode'
import type { DecodedSceneUpdate } from '@/lib/mcap/foxglove-scene-update-decode'
import { isSceneUpdateSchema } from '@/lib/mcap/foxglove-scene-update-decode'
import type { McapTopicInfo } from '@/lib/playback/atoms'
import { tfRuntimeStore } from '@/lib/ros/tf-runtime-store'
import type { DecodedCameraInfo } from '@/lib/ros/camera-info-store'
import { isCameraInfoSchema } from '@/lib/ros/decode-camera-info'

type ImageFrameFn = (topic: string, frame: DecodedCameraFrame) => void
type PointCloudFn = (topic: string, cloud: DecodedPointCloud) => void
type LaserScanFn = (topic: string, scan: DecodedLaserScan) => void
type SceneUpdateFn = (topic: string, update: DecodedSceneUpdate) => void
type CameraInfoFn = (topic: string, info: DecodedCameraInfo) => void
type OdomFn = (pose: OdomMessage) => void

interface ChannelMeta {
  topic: string
  schemaName: string
  messageEncoding: string
  schemaId: number
}

function normalizeFrameId(frame: string): string {
  return frame.startsWith('/') ? frame.slice(1) : frame
}

function isTfLikeSchema(schemaName: string): boolean {
  return (
    schemaName.includes('TFMessage') ||
    schemaName === 'foxglove.FrameTransform' ||
    schemaName === 'foxglove.PoseInFrame'
  )
}

class McapReplayController {
  private reader: McapIndexedReader | null = null
  private channels = new Map<number, ChannelMeta>()
  private startTimeNs = BigInt(0)
  private endTimeNs = BigInt(0)
  private lastFlushTimeNs = BigInt(0)
  private imageSubs = new Map<string, Set<ImageFrameFn>>()
  private pointCloudSubs = new Map<string, Set<PointCloudFn>>()
  private laserScanSubs = new Map<string, Set<LaserScanFn>>()
  private sceneUpdateSubs = new Map<string, Set<SceneUpdateFn>>()
  private cameraInfoSubs = new Map<string, Set<CameraInfoFn>>()
  private onOdom: OdomFn | null = null
  private flushing = false
  private flushQueued: bigint | null = null
  private flushQueuedSeek = false
  private reflushTimer: ReturnType<typeof setTimeout> | null = null

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
    if (this.reflushTimer != null) {
      clearTimeout(this.reflushTimer)
      this.reflushTimer = null
    }
    this.reader = null
    this.channels.clear()
    this.lastFlushTimeNs = BigInt(0)
    this.flushQueued = null
    this.flushQueuedSeek = false
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

  subscribeLaserScan(topic: string, callback: LaserScanFn): () => void {
    let set = this.laserScanSubs.get(topic)
    const isNewTopic = !set
    if (!set) {
      set = new Set()
      this.laserScanSubs.set(topic, set)
    }
    set.add(callback)
    if (isNewTopic) this.reflushAfterSubscribe()
    return () => {
      const current = this.laserScanSubs.get(topic)
      if (!current) return
      current.delete(callback)
      if (current.size === 0) this.laserScanSubs.delete(topic)
    }
  }

  subscribeSceneUpdate(topic: string, callback: SceneUpdateFn): () => void {
    let set = this.sceneUpdateSubs.get(topic)
    const isNewTopic = !set
    if (!set) {
      set = new Set()
      this.sceneUpdateSubs.set(topic, set)
    }
    set.add(callback)
    if (isNewTopic) this.reflushAfterSubscribe()
    return () => {
      const current = this.sceneUpdateSubs.get(topic)
      if (!current) return
      current.delete(callback)
      if (current.size === 0) this.sceneUpdateSubs.delete(topic)
    }
  }

  subscribeCameraInfo(topic: string, callback: CameraInfoFn): () => void {
    let set = this.cameraInfoSubs.get(topic)
    const isNewTopic = !set
    if (!set) {
      set = new Set()
      this.cameraInfoSubs.set(topic, set)
    }
    set.add(callback)
    if (isNewTopic) this.reflushAfterSubscribe()
    return () => {
      const current = this.cameraInfoSubs.get(topic)
      if (!current) return
      current.delete(callback)
      if (current.size === 0) this.cameraInfoSubs.delete(topic)
    }
  }

  /** Debounce full seek reflush — rapid eye toggles / remounts must not stack seeks */
  private reflushAfterSubscribe() {
    if (!this.reader || this.lastFlushTimeNs === BigInt(0)) return
    if (this.reflushTimer != null) clearTimeout(this.reflushTimer)
    this.reflushTimer = setTimeout(() => {
      this.reflushTimer = null
      if (!this.reader || this.lastFlushTimeNs === BigInt(0)) return
      void this.flushToTime(this.lastFlushTimeNs, true)
    }, 80)
  }

  private isTopicSubscribed(topic: string, schemaName: string, messageEncoding: string): boolean {
    if (isTfLikeSchema(schemaName)) return true
    if (schemaName.includes('Odometry') && this.onOdom) return true
    if (
      this.imageSubs.has(topic) ||
      this.pointCloudSubs.has(topic) ||
      this.laserScanSubs.has(topic) ||
      this.sceneUpdateSubs.has(topic) ||
      this.cameraInfoSubs.has(topic)
    ) {
      return true
    }
    if (messageEncoding === 'protobuf' && schemaName.includes('PointCloud')) {
      return this.pointCloudSubs.size > 0
    }
    if (isCameraInfoSchema(schemaName) && this.cameraInfoSubs.has(topic)) {
      return true
    }
    return false
  }

  private isSensorMessage(schemaName: string, messageEncoding: string): boolean {
    if (messageEncoding === 'protobuf') {
      return (
        schemaName.includes('PointCloud') ||
        schemaName.includes('CompressedImage') ||
        schemaName.includes('CameraCalibration') ||
        isSceneUpdateSchema(schemaName)
      )
    }
    return (
      schemaName.includes('PointCloud2') ||
      schemaName.includes('LaserScan') ||
      schemaName.includes('CompressedImage') ||
      schemaName.includes('CameraInfo') ||
      schemaName.includes('/Image')
    )
  }

  private decodeTfLike(
    topic: string,
    schemaName: string,
    messageEncoding: string,
    schemaId: number,
    data: Uint8Array,
  ): DecodedTfTransform[] | null {
    if (messageEncoding === 'protobuf' || schemaName.startsWith('foxglove.')) {
      if (schemaName === 'foxglove.FrameTransform') {
        return decodeFoxgloveFrameTransform(schemaId, data)
      }
      if (schemaName === 'foxglove.PoseInFrame') {
        return decodeFoxglovePoseInFrame(schemaId, data, topic)
      }
    }
    if (schemaName.includes('TFMessage')) {
      return decodeTfMessage(data)
    }
    return null
  }

  async seek(timeNs: bigint) {
    this.lastFlushTimeNs = this.startTimeNs
    for (const topic of this.imageSubs.keys()) {
      resetImageDecoderForSeek(topic)
    }
    await this.flushToTime(timeNs, true)
  }

  /**
   * Coalesce concurrent flushes to the latest target time.
   * Previous implementation recursively called flushToTime while `flushing`
   * was still true, which re-queued forever and froze the UI on rapid play/pause.
   */
  async flushToTime(timeNs: bigint, isSeek = false) {
    if (!this.reader) return

    if (this.flushing) {
      this.flushQueued = timeNs
      this.flushQueuedSeek = isSeek || timeNs < this.lastFlushTimeNs
      return
    }

    this.flushing = true
    try {
      let target = timeNs
      let seek = isSeek
      for (;;) {
        await this.flushOnce(target, seek)
        if (this.flushQueued == null) break
        target = this.flushQueued
        seek = this.flushQueuedSeek || target < this.lastFlushTimeNs
        this.flushQueued = null
        this.flushQueuedSeek = false
      }
    } finally {
      this.flushing = false
    }
  }

  private async flushOnce(timeNs: bigint, isSeek: boolean) {
    if (!this.reader) return

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
    /** Latest TF edge per child — avoid applying every historical /tf on seek */
    const latestTfByChild = new Map<string, DecodedTfTransform>()
    let latestOdom: OdomMessage | null = null

    const handlers = {
      onOdom: this.onOdom ?? undefined,
      onImage: (topic: string, frame: DecodedCameraFrame) => {
        for (const cb of this.imageSubs.get(topic) ?? []) cb(topic, frame)
      },
      onPointCloud: (topic: string, cloud: DecodedPointCloud) => {
        for (const cb of this.pointCloudSubs.get(topic) ?? []) cb(topic, cloud)
      },
      onLaserScan: (topic: string, scan: DecodedLaserScan) => {
        for (const cb of this.laserScanSubs.get(topic) ?? []) cb(topic, scan)
      },
      onSceneUpdate: (topic: string, update: DecodedSceneUpdate) => {
        for (const cb of this.sceneUpdateSubs.get(topic) ?? []) cb(topic, update)
      },
      onCameraInfo: (topic: string, info: DecodedCameraInfo) => {
        for (const cb of this.cameraInfoSubs.get(topic) ?? []) cb(topic, info)
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

      if (isTfLikeSchema(meta.schemaName)) {
        const transforms = this.decodeTfLike(
          meta.topic,
          meta.schemaName,
          meta.messageEncoding,
          meta.schemaId,
          data,
        )
        if (transforms) {
          for (const t of transforms) {
            const child = normalizeFrameId(t.childFrame)
            if (child) latestTfByChild.set(child, t)
          }
        }
        continue
      }

      if (meta.schemaName.includes('Odometry') && this.onOdom) {
        const pose = decodeOdometry(data)
        if (pose) latestOdom = pose
        continue
      }

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

    if (isSeek) {
      tfRuntimeStore.clearEdges()
    }

    if (latestTfByChild.size > 0) {
      tfRuntimeStore.setActive(true)
      tfRuntimeStore.updateTransforms([...latestTfByChild.values()])
    }

    if (latestOdom && this.onOdom) {
      this.onOdom(latestOdom)
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
  }
}

export const mcapReplayController = new McapReplayController()
