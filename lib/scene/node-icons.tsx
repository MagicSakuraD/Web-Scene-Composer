import {
  Box,
  Circle,
  Sun,
  Lightbulb,
  Layers,
  FileBox,
  MapPin,
  Mountain,
  Boxes,
  Bone,
  Camera,
  Component,
} from 'lucide-react'
import type { GltfPrimKind, NodeType, SceneNode } from './types'

export function getNodeIcon(node: Pick<SceneNode, 'type' | 'gltfKind'>) {
  if (node.type === 'gltf-prim' && node.gltfKind) {
    return getGltfPrimIcon(node.gltfKind)
  }

  switch (node.type) {
    case 'group':
      return <Layers className="h-3.5 w-3.5 text-muted-foreground" />
    case 'ground':
      return <Mountain className="h-3.5 w-3.5 text-muted-foreground" />
    case 'cube':
      return <Box className="h-3.5 w-3.5 text-muted-foreground" />
    case 'sphere':
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />
    case 'nav-waypoint':
      return <MapPin className="h-3.5 w-3.5 text-green-500" />
    case 'distant-light':
      return <Sun className="h-3.5 w-3.5 text-amber-400" />
    case 'point-light':
      return <Lightbulb className="h-3.5 w-3.5 text-yellow-300" />
    case 'physical-distant-light':
      return <Sun className="h-3.5 w-3.5 text-white" />
    case 'asset-ref':
      return <FileBox className="h-3.5 w-3.5 text-primary" />
    default:
      return <Box className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function getGltfPrimIcon(kind: GltfPrimKind) {
  switch (kind) {
    case 'Mesh':
    case 'SkinnedMesh':
      return <Component className="h-3.5 w-3.5 text-cyan-500" />
    case 'Bone':
      return <Bone className="h-3.5 w-3.5 text-orange-400" />
    case 'Light':
      return <Lightbulb className="h-3.5 w-3.5 text-yellow-300" />
    case 'Camera':
      return <Camera className="h-3.5 w-3.5 text-muted-foreground" />
    case 'Xform':
      return <Boxes className="h-3.5 w-3.5 text-purple-400" />
    default:
      return <Box className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

export function getGltfKindLabel(kind: GltfPrimKind) {
  return kind
}
