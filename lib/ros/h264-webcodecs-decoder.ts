/**
 * Isaac Sim `rgb_h264` → sensor_msgs/CompressedImage（format=h264）。
 * 每帧为完整 IDR，可用 WebCodecs VideoDecoder 独立解码。
 * @see https://docs.isaacsim.omniverse.nvidia.com/6.0.1/ros2_tutorials/tutorial_ros2_compressed_image.html
 */

export type H264DecodeResult = {
  bitmap: ImageBitmap
  width: number
  height: number
}

function isWebCodecsAvailable(): boolean {
  return typeof VideoDecoder !== 'undefined' && typeof EncodedVideoChunk !== 'undefined'
}

function looksLikeAnnexB(data: Uint8Array): boolean {
  if (data.length < 4) return false
  if (data[0] === 0 && data[1] === 0 && data[2] === 1) return true
  return data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1
}

/** AVCC length-prefixed → Annex-B start codes（部分编码器会发 AVCC） */
function avccToAnnexB(data: Uint8Array): Uint8Array {
  const out: number[] = []
  let i = 0
  while (i + 4 <= data.length) {
    const n =
      ((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0
    i += 4
    if (n <= 0 || i + n > data.length) return data
    out.push(0, 0, 0, 1)
    for (let j = 0; j < n; j++) out.push(data[i + j]!)
    i += n
  }
  return new Uint8Array(out)
}

function normalizeToAnnexB(data: Uint8Array): Uint8Array {
  if (looksLikeAnnexB(data)) return data
  return avccToAnnexB(data)
}

/**
 * 每个话题一个长期 VideoDecoder（WebCodecs 有状态）。
 * Isaac 每帧是 IDR，可全部标为 key。
 */
export class H264TopicDecoder {
  private decoder: VideoDecoder | null = null
  private configured = false
  private configureFailed = false
  private pending: {
    resolve: (v: H264DecodeResult | null) => void
    reject: (e: unknown) => void
  } | null = null
  private timestampUs = 0
  private readonly codecCandidates = ['avc1.64001e', 'avc1.42E01E', 'avc1.4D401E'] as const
  private codecIndex = 0
  private busy = false
  private latest: Uint8Array | null = null

  constructor(readonly topic: string) {}

  private ensureDecoder() {
    if (this.decoder) return
    if (!isWebCodecsAvailable()) {
      throw new Error('WebCodecs VideoDecoder 不可用（需 Chromium / Edge）')
    }

    this.decoder = new VideoDecoder({
      output: (frame) => {
        const pending = this.pending
        this.pending = null
        if (!pending) {
          frame.close()
          return
        }
        void createImageBitmap(frame)
          .then((bitmap) => {
            pending.resolve({
              bitmap,
              width: frame.displayWidth || frame.codedWidth,
              height: frame.displayHeight || frame.codedHeight,
            })
          })
          .catch((err) => pending.reject(err))
          .finally(() => frame.close())
      },
      error: (err) => {
        const pending = this.pending
        this.pending = null
        this.configured = false
        pending?.reject(err)
      },
    })
  }

  private configure(codec: string) {
    this.ensureDecoder()
    this.decoder!.configure({
      codec,
      optimizeForLatency: true,
    })
    this.configured = true
  }

  /** 合并重叠调用：只保留最新一帧（实时预览，允许丢帧） */
  async decode(encoded: Uint8Array): Promise<H264DecodeResult | null> {
    this.latest = encoded
    if (this.busy) return null
    this.busy = true

    let result: H264DecodeResult | null = null
    try {
      while (this.latest) {
        const data = this.latest
        this.latest = null
        result = await this.decodeOnce(data)
      }
    } finally {
      this.busy = false
    }
    return result
  }

  private async decodeOnce(encoded: Uint8Array): Promise<H264DecodeResult | null> {
    if (encoded.length === 0) return null
    if (this.configureFailed) return null

    try {
      this.ensureDecoder()
    } catch (err) {
      console.warn(`[H264] ${this.topic}:`, err)
      this.configureFailed = true
      return null
    }

    const annexB = normalizeToAnnexB(encoded)
    this.timestampUs += 33_000

    const tryDecodeOnce = (codec: string) =>
      new Promise<H264DecodeResult | null>((resolve, reject) => {
        if (!this.configured) {
          try {
            this.configure(codec)
          } catch (err) {
            reject(err)
            return
          }
        }

        if (this.pending) {
          this.pending.resolve(null)
          this.pending = null
        }
        this.pending = { resolve, reject }

        try {
          const chunk = new EncodedVideoChunk({
            type: 'key',
            timestamp: this.timestampUs,
            data: annexB,
          })
          this.decoder!.decode(chunk)
          void this.decoder!.flush().catch(() => {
            /* flush error surfaces via decoder.error */
          })
        } catch (err) {
          this.pending = null
          reject(err)
        }
      })

    let lastError: unknown
    for (let attempt = 0; attempt < this.codecCandidates.length; attempt++) {
      const codec = this.codecCandidates[this.codecIndex]!
      try {
        return await tryDecodeOnce(codec)
      } catch (err) {
        lastError = err
        this.resetDecoder()
        this.codecIndex = (this.codecIndex + 1) % this.codecCandidates.length
      }
    }

    console.warn(`[H264] ${this.topic} 解码失败`, lastError)
    this.configureFailed = true
    return null
  }

  private resetDecoder() {
    try {
      this.decoder?.close()
    } catch {
      /* already closed */
    }
    this.decoder = null
    this.configured = false
    if (this.pending) {
      this.pending.resolve(null)
      this.pending = null
    }
  }

  close() {
    this.resetDecoder()
    this.configureFailed = false
  }
}

const decoders = new Map<string, H264TopicDecoder>()

export function getH264Decoder(topic: string): H264TopicDecoder {
  let d = decoders.get(topic)
  if (!d) {
    d = new H264TopicDecoder(topic)
    decoders.set(topic, d)
  }
  return d
}

export function releaseH264Decoder(topic: string) {
  const d = decoders.get(topic)
  if (!d) return
  d.close()
  decoders.delete(topic)
}

export function releaseAllH264Decoders() {
  for (const d of decoders.values()) d.close()
  decoders.clear()
}
