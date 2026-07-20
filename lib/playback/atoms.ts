import { atom } from 'jotai'
import { simulateStatusAtom } from '@/lib/ros/atoms'

export type AppMode = 'compose' | 'playback'

export type DataSourceMode = 'idle' | 'live' | 'replay'

export interface McapTopicInfo {
  topic: string
  schemaName: string
  channelId: number
  messageEncoding: string
  schemaId: number
}

export interface PlaybackRange {
  startNs: bigint
  endNs: bigint
}

export const appModeAtom = atom<AppMode>('compose')

export const dataSourceModeAtom = atom<DataSourceMode>('idle')

export const playbackTimeNsAtom = atom<bigint>(BigInt(0))

export const playbackRangeAtom = atom<PlaybackRange | null>(null)

export const playbackPlayingAtom = atom<boolean>(false)

export const playbackRateAtom = atom<number>(1)

export const mcapFileNameAtom = atom<string | null>(null)

export const mcapTopicsAtom = atom<McapTopicInfo[]>([])

export const topicVisibilityAtom = atom<Record<string, boolean>>({})

export const selectedTopicAtom = atom<string | null>(null)

export const mcapLoadErrorAtom = atom<string | null>(null)

export const mcapLoadingAtom = atom<boolean>(false)

/** Live Foxglove 或 MCAP 回放数据源是否活跃 */
export const dataSourceActiveAtom = atom((get) => {
  const mode = get(dataSourceModeAtom)
  if (mode === 'live') return get(simulateStatusAtom) === 'connected'
  if (mode === 'replay') {
    const range = get(playbackRangeAtom)
    return range != null && range.endNs > range.startNs
  }
  return false
})
