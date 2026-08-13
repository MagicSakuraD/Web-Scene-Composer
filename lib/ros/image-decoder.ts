import {
  parseCompressedImageMessage,
  type DecodedCameraFrame,
  type RosCompressedImageMessage,
  type RosImageMessage,
  imageReader,
} from '@/lib/foxglove/ros-serialization'
import { getH264Decoder, releaseH264Decoder } from '@/lib/ros/h264-webcodecs-decoder'

function normalizeImageData(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw
  if (Array.isArray(raw)) return Uint8Array.from(raw)
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) {
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  }
  return new Uint8Array()
}

function mimeFromFormat(format: string): string | null {
  const f = format.toLowerCase()
  if (f.includes('jpeg') || f.includes('jpg')) return 'image/jpeg'
  if (f.includes('png')) return 'image/png'
  if (f.includes('webp')) return 'image/webp'
  return null
}

async function decodeBlobImage(
  data: Uint8Array,
  mime: string,
): Promise<{ bitmap: ImageBitmap; width: number; height: number } | null> {
  try {
    const blob = new Blob([data as BlobPart], { type: mime })
    const bitmap = await createImageBitmap(blob)
    return { bitmap, width: bitmap.width, height: bitmap.height }
  } catch {
    return null
  }
}

function decodeRawRosImage(
  msg: RosImageMessage,
): Promise<{ bitmap: ImageBitmap; width: number; height: number } | null> {
  const { width, height, encoding, data } = msg
  if (width <= 0 || height <= 0 || data.length === 0) return Promise.resolve(null)

  const enc = encoding.toLowerCase()
  const step = Math.max(Number(msg.step) || 0, width)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return Promise.resolve(null)

  const imageData = ctx.createImageData(width, height)
  const out = imageData.data

  if (enc === 'rgb8') {
    const need = step * (height - 1) + width * 3
    if (data.length < need) return Promise.resolve(null)
    for (let y = 0; y < height; y++) {
      const row = y * step
      for (let x = 0; x < width; x++) {
        const j = row + x * 3
        const o = (y * width + x) * 4
        out[o] = data[j]!
        out[o + 1] = data[j + 1]!
        out[o + 2] = data[j + 2]!
        out[o + 3] = 255
      }
    }
  } else if (enc === 'bgr8') {
    const need = step * (height - 1) + width * 3
    if (data.length < need) return Promise.resolve(null)
    for (let y = 0; y < height; y++) {
      const row = y * step
      for (let x = 0; x < width; x++) {
        const j = row + x * 3
        const o = (y * width + x) * 4
        out[o] = data[j + 2]!
        out[o + 1] = data[j + 1]!
        out[o + 2] = data[j]!
        out[o + 3] = 255
      }
    }
  } else if (enc === 'mono8') {
    const need = step * (height - 1) + width
    if (data.length < need) return Promise.resolve(null)
    for (let y = 0; y < height; y++) {
      const row = y * step
      for (let x = 0; x < width; x++) {
        const v = data[row + x]!
        const o = (y * width + x) * 4
        out[o] = v
        out[o + 1] = v
        out[o + 2] = v
        out[o + 3] = 255
      }
    }
  } else if (enc === 'rgba8') {
    const need = step * (height - 1) + width * 4
    if (data.length < need) return Promise.resolve(null)
    for (let y = 0; y < height; y++) {
      const row = y * step
      for (let x = 0; x < width; x++) {
        const j = row + x * 4
        const o = (y * width + x) * 4
        out[o] = data[j]!
        out[o + 1] = data[j + 1]!
        out[o + 2] = data[j + 2]!
        out[o + 3] = data[j + 3]!
      }
    }
  } else {
    return Promise.resolve(null)
  }

  ctx.putImageData(imageData, 0, 0)

  // Frustum / preview: downscale huge Isaac frames so UI stays responsive
  const maxEdge = 960
  if (width > maxEdge || height > maxEdge) {
    const scale = maxEdge / Math.max(width, height)
    const dw = Math.max(1, Math.round(width * scale))
    const dh = Math.max(1, Math.round(height * scale))
    const small = document.createElement('canvas')
    small.width = dw
    small.height = dh
    const sctx = small.getContext('2d')
    if (!sctx) return Promise.resolve(null)
    sctx.drawImage(canvas, 0, 0, dw, dh)
    return createImageBitmap(small).then((bitmap) => ({
      bitmap,
      width: dw,
      height: dh,
    }))
  }

  return createImageBitmap(canvas).then((bitmap) => ({ bitmap, width, height }))
}

export async function decodeCompressedImageMessage(
  topic: string,
  msg: RosCompressedImageMessage,
): Promise<DecodedCameraFrame | null> {
  if (!msg.data.length) return null

  const format = msg.format.toLowerCase()
  let decoded: { bitmap: ImageBitmap; width: number; height: number } | null = null

  if (format.includes('h264') || format.includes('avc')) {
    decoded = await getH264Decoder(topic).decode(msg.data)
  } else {
    const mime = mimeFromFormat(format)
    if (mime) {
      decoded = await decodeBlobImage(msg.data, mime)
    }
  }

  if (!decoded) return null

  return {
    width: decoded.width,
    height: decoded.height,
    encoding: msg.format,
    stampSec: msg.header.stamp.sec,
    stampNanosec: msg.header.stamp.nanosec,
    frameId: msg.header.frame_id,
    bitmap: decoded.bitmap,
  }
}

export async function decodeRosImageMessage(
  data: Uint8Array,
): Promise<DecodedCameraFrame | null> {
  try {
    const raw = imageReader.readMessage<RosImageMessage>(data)
    const msg: RosImageMessage = {
      ...raw,
      data: normalizeImageData(raw.data),
    }
    const decoded = await decodeRawRosImage(msg)
    if (!decoded) return null
    return {
      width: decoded.width,
      height: decoded.height,
      encoding: msg.encoding,
      stampSec: msg.header.stamp.sec,
      stampNanosec: msg.header.stamp.nanosec,
      frameId: msg.header.frame_id,
      bitmap: decoded.bitmap,
    }
  } catch {
    return null
  }
}

export async function decodeImagePayload(
  topic: string,
  schemaName: string,
  data: Uint8Array,
): Promise<DecodedCameraFrame | null> {
  if (schemaName.includes('CompressedImage')) {
    const msg = parseCompressedImageMessage(data)
    if (!msg) return null
    return decodeCompressedImageMessage(topic, msg)
  }
  if (schemaName.includes('Image')) {
    return decodeRosImageMessage(data)
  }
  return null
}

export function resetImageDecoderForSeek(topic: string) {
  releaseH264Decoder(topic)
}
