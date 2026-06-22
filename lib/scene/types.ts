export type NodeType =
  | 'group'
  | 'ground'
  | 'cube'
  | 'sphere'
  | 'distant-light'
  | 'point-light'
  | 'asset-ref'
  | 'gltf-prim'

/** glTF scene graph prim kind — mirrors USD / Isaac Sim outliner semantics */
export type GltfPrimKind =
  | 'Xform'
  | 'Mesh'
  | 'SkinnedMesh'
  | 'Bone'
  | 'Light'
  | 'Camera'
  | 'Object3D'

export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale'
export type SpaceMode = 'world' | 'local'

export interface Transform {
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

export interface SceneNode {
  id: string
  name: string
  type: NodeType
  transform: Transform
  parentId: string | null
  lightIntensity?: number
  lightColor?: string
  assetUrl?: string
  /** glTF internal prim — shown in hierarchy, rendered via parent asset-ref */
  gltfKind?: GltfPrimKind
  gltfPath?: string
  assetRootId?: string
}

export interface SceneTreeNode extends SceneNode {
  children: SceneTreeNode[]
}

export interface UiPanelsState {
  leftOpen: boolean
  rightOpen: boolean
  bottomOpen: boolean
}

export const DEFAULT_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
}

export const ROBOT_ASSET_URL =
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/RobotExpressive/RobotExpressive.glb'

export interface ProjectAsset {
  id: string
  name: string
  url: string
  kind: 'glb' | 'gltf'
}

export function isGltfHierarchyNode(node: SceneNode) {
  return node.type === 'gltf-prim'
}

export function isRenderableSceneNode(node: SceneNode) {
  return node.type !== 'gltf-prim'
}
