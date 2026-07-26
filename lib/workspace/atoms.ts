import { atom } from 'jotai'
import { appModeAtom, type AppMode } from '@/lib/playback/atoms'
import type { SidePanelType, SideSlot } from './types'
import {
  loadStoredSidePanels,
  saveSidePanelsForMode,
  SIDE_PANEL_DEFAULTS,
  type SidePanelLayout,
} from './storage'

/** SSR-safe defaults only — never read localStorage at module init */
export const leftSidePanelAtom = atom<SidePanelType>(SIDE_PANEL_DEFAULTS.compose.left)
export const rightSidePanelAtom = atom<SidePanelType>(SIDE_PANEL_DEFAULTS.compose.right)

function persistSlot(
  mode: AppMode,
  slot: SideSlot,
  type: SidePanelType,
  get: <T>(a: import('jotai').Atom<T>) => T,
): void {
  const layout: SidePanelLayout = {
    left: slot === 'left' ? type : get(leftSidePanelAtom),
    right: slot === 'right' ? type : get(rightSidePanelAtom),
  }
  saveSidePanelsForMode(mode, layout)
}

export const setSidePanelAtom = atom(
  null,
  (get, set, args: { slot: SideSlot; type: SidePanelType }) => {
    const mode = get(appModeAtom)
    if (args.slot === 'left') {
      set(leftSidePanelAtom, args.type)
    } else {
      set(rightSidePanelAtom, args.type)
    }
    persistSlot(mode, args.slot, args.type, get)
  },
)

function resolveLayout(mode: AppMode): SidePanelLayout {
  const stored = loadStoredSidePanels()[mode]
  return stored ?? { ...SIDE_PANEL_DEFAULTS[mode] }
}

/** Apply layout for mode (call only after mount to avoid hydration mismatch) */
export const syncSidePanelsToAppModeAtom = atom(null, (_get, set, mode: AppMode) => {
  const layout = resolveLayout(mode)
  set(leftSidePanelAtom, layout.left)
  set(rightSidePanelAtom, layout.right)
})
