import type { SidePanelDefinition, SidePanelType } from './types'

export const SIDE_PANEL_TYPES: SidePanelType[] = [
  'hierarchy',
  'topics',
  'inspector',
  'frame-inspector',
]

export const SIDE_PANEL_REGISTRY: Record<SidePanelType, SidePanelDefinition> = {
  hierarchy: {
    type: 'hierarchy',
    nameKey: 'sidePanel.hierarchy.name',
    descriptionKey: 'sidePanel.hierarchy.description',
  },
  topics: {
    type: 'topics',
    nameKey: 'sidePanel.topics.name',
    descriptionKey: 'sidePanel.topics.description',
  },
  inspector: {
    type: 'inspector',
    nameKey: 'sidePanel.inspector.name',
    descriptionKey: 'sidePanel.inspector.description',
  },
  'frame-inspector': {
    type: 'frame-inspector',
    nameKey: 'sidePanel.frameInspector.name',
    descriptionKey: 'sidePanel.frameInspector.description',
  },
}

export function getSidePanelDef(type: SidePanelType): SidePanelDefinition {
  return SIDE_PANEL_REGISTRY[type]
}
