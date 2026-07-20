'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { playbackPlayingAtom } from '@/lib/playback/atoms'
import { playbackEngine } from '@/lib/playback/playback-engine'

/** 空格键切换播放/暂停（仅回放模式） */
export function usePlaybackShortcuts() {
  const playing = useAtomValue(playbackPlayingAtom)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const target = e.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return
      }
      e.preventDefault()
      if (playing) playbackEngine.pause()
      else playbackEngine.play()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playing])
}
