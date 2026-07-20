import { McapIndexedReader } from '@mcap/core'
import { BlobReadable } from '@mcap/browser'
import { protobufRegistry } from '@/lib/mcap/protobuf-registry'
import type { McapTopicInfo } from '@/lib/playback/atoms'

export interface McapLoadResult {
  reader: McapIndexedReader
  topics: McapTopicInfo[]
  startTimeNs: bigint
  endTimeNs: bigint
  fileName: string
}

/** 浏览器端按需加载 lz4/zstd 解压器（不经过 @mcap/support，避免 wasm-bz2 构建错误） */
async function loadDecompressHandlersSafe() {
  if (typeof window === 'undefined') return undefined
  const { loadBrowserDecompressHandlers } = await import('@/lib/mcap/decompress-handlers')
  return loadBrowserDecompressHandlers()
}

export async function loadMcapFile(file: File): Promise<McapLoadResult> {
  const decompressHandlers = await loadDecompressHandlersSafe()
  const reader = await McapIndexedReader.Initialize({
    readable: new BlobReadable(file),
    decompressHandlers,
  })

  const stats = reader.statistics
  if (stats?.messageStartTime == null || stats?.messageEndTime == null) {
    throw new Error('MCAP 文件缺少时间统计信息，请使用带索引的 MCAP 文件')
  }

  const topics: McapTopicInfo[] = []
  for (const channel of reader.channelsById.values()) {
    const schema =
      channel.schemaId != null ? reader.schemasById.get(channel.schemaId) : undefined
    topics.push({
      topic: channel.topic,
      schemaName: schema?.name ?? 'unknown',
      channelId: channel.id,
      messageEncoding: channel.messageEncoding,
      schemaId: channel.schemaId ?? -1,
    })
  }

  topics.sort((a, b) => a.topic.localeCompare(b.topic))
  protobufRegistry.loadFromReader(reader)

  return {
    reader,
    topics,
    startTimeNs: stats.messageStartTime,
    endTimeNs: stats.messageEndTime,
    fileName: file.name,
  }
}
