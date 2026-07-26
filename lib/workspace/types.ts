/** Side slot panel types (left / right only; viewport is not switchable) */
export type SidePanelType = 'hierarchy' | 'topics' | 'inspector' | 'frame-inspector'

export type SideSlot = 'left' | 'right'

export interface SidePanelDefinition {
  type: SidePanelType
  nameKey: import('@/lib/i18n/messages').MessageKey
  descriptionKey: import('@/lib/i18n/messages').MessageKey
}
