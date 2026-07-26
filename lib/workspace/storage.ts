import type { AppMode } from '@/lib/playback/atoms'
import type { SidePanelType, SideSlot } from './types'

const STORAGE_KEY = 'wsc.sidePanels.v1'

export type SidePanelLayout = Record<SideSlot, SidePanelType>

export type StoredSidePanels = Partial<Record<AppMode, SidePanelLayout>>

export const SIDE_PANEL_DEFAULTS: Record<AppMode, SidePanelLayout> = {
  compose: { left: 'hierarchy', right: 'inspector' },
  playback: { left: 'topics', right: 'frame-inspector' },
}

export function loadStoredSidePanels(): StoredSidePanels {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredSidePanels
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveSidePanelsForMode(mode: AppMode, layout: SidePanelLayout): void {
  if (typeof window === 'undefined') return
  try {
    const prev = loadStoredSidePanels()
    prev[mode] = layout
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prev))
  } catch {
    // ignore
  }
}
