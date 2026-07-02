export type MaterialGraphNodeType =

  | 'texture'

  | 'color'

  | 'float'

  | 'uv'

  | 'multiply'

  | 'add'

  | 'mix'

  | 'principled'

  | 'output'



export interface MaterialGraphPort {

  id: string

  label: string

  direction: 'in' | 'out'

  /** color = vec3, float = scalar */

  valueKind?: 'color' | 'float'

}



export interface MaterialGraphNode {

  id: string

  type: MaterialGraphNodeType

  title: string

  position: { x: number; y: number }

  data: Record<string, string | number | boolean>

}



export interface MaterialGraphEdge {

  id: string

  from: { nodeId: string; port: string }

  to: { nodeId: string; port: string }

}



export interface MaterialGraph {

  id: string

  name: string

  nodes: MaterialGraphNode[]

  edges: MaterialGraphEdge[]

}



export const NODE_PORTS: Record<MaterialGraphNodeType, MaterialGraphPort[]> = {

  texture: [{ id: 'colorOut', label: 'Color', direction: 'out', valueKind: 'color' }],

  color: [{ id: 'colorOut', label: 'Color', direction: 'out', valueKind: 'color' }],

  float: [{ id: 'out', label: 'Value', direction: 'out', valueKind: 'float' }],

  uv: [{ id: 'out', label: 'UV', direction: 'out', valueKind: 'color' }],

  multiply: [

    { id: 'a', label: 'A', direction: 'in', valueKind: 'color' },

    { id: 'b', label: 'B', direction: 'in', valueKind: 'color' },

    { id: 'out', label: 'Result', direction: 'out', valueKind: 'color' },

  ],

  add: [

    { id: 'a', label: 'A', direction: 'in', valueKind: 'color' },

    { id: 'b', label: 'B', direction: 'in', valueKind: 'color' },

    { id: 'out', label: 'Result', direction: 'out', valueKind: 'color' },

  ],

  mix: [

    { id: 'a', label: 'A', direction: 'in', valueKind: 'color' },

    { id: 'b', label: 'B', direction: 'in', valueKind: 'color' },

    { id: 'factor', label: 'Factor', direction: 'in', valueKind: 'float' },

    { id: 'out', label: 'Result', direction: 'out', valueKind: 'color' },

  ],

  principled: [

    { id: 'baseColor', label: 'Base Color', direction: 'in', valueKind: 'color' },

    { id: 'roughness', label: 'Roughness', direction: 'in', valueKind: 'float' },

    { id: 'metalness', label: 'Metallic', direction: 'in', valueKind: 'float' },

    { id: 'emissive', label: 'Emissive', direction: 'in', valueKind: 'color' },

    { id: 'normal', label: 'Normal', direction: 'in', valueKind: 'color' },

    { id: 'opacity', label: 'Opacity', direction: 'in', valueKind: 'float' },

    { id: 'transmission', label: 'Transmission', direction: 'in', valueKind: 'float' },

    { id: 'clearcoat', label: 'Clearcoat', direction: 'in', valueKind: 'float' },

    { id: 'ior', label: 'IOR', direction: 'in', valueKind: 'float' },

    { id: 'surface', label: 'BSDF', direction: 'out', valueKind: 'color' },

  ],

  output: [{ id: 'surface', label: 'Custom Surface', direction: 'in', valueKind: 'color' }],

}



/** 不可删除的节点类型 */

export const PROTECTED_NODE_TYPES: MaterialGraphNodeType[] = ['output']


