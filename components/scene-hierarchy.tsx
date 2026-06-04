'use client'

import {
  ChevronRight,
  ChevronDown,
  Folder,
  File,
  Box,
  Layers,
  Mountain,
  Droplets,
  TreePine,
  Car,
  Ship,
  Palette,
  Circle,
} from 'lucide-react'
import { useState } from 'react'

interface TreeNode {
  id: string
  name: string
  icon?: React.ReactNode
  children?: TreeNode[]
  expanded?: boolean
}

const sceneData: TreeNode[] = [
  {
    id: 'root',
    name: 'Root',
    icon: <Box className="h-3.5 w-3.5 text-muted-foreground" />,
    expanded: true,
    children: [
      {
        id: 'globalscale',
        name: 'GlobalScale',
        icon: <Layers className="h-3.5 w-3.5 text-muted-foreground" />,
        expanded: true,
        children: [
          {
            id: 'terrain',
            name: 'Terrain',
            icon: <Folder className="h-3.5 w-3.5 text-yellow-500" />,
            expanded: true,
            children: [
              { id: 'ground', name: 'Ground', icon: <Mountain className="h-3.5 w-3.5 text-muted-foreground" /> },
              { id: 'water', name: 'Water', icon: <Droplets className="h-3.5 w-3.5 text-blue-400" /> },
              { id: 'street', name: 'Street', icon: <Car className="h-3.5 w-3.5 text-muted-foreground" /> },
            ],
          },
          {
            id: 'setdressing',
            name: 'SetDressing',
            icon: <Folder className="h-3.5 w-3.5 text-yellow-500" />,
            expanded: true,
            children: [
              { id: 'structures', name: 'Structures', icon: <Box className="h-3.5 w-3.5 text-muted-foreground" /> },
              { id: 'rocks', name: 'Rocks', icon: <Circle className="h-3.5 w-3.5 text-muted-foreground" /> },
              { id: 'trees', name: 'Trees', icon: <TreePine className="h-3.5 w-3.5 text-green-500" /> },
              { id: 'boats', name: 'Boats', icon: <Ship className="h-3.5 w-3.5 text-muted-foreground" /> },
              { id: 'beachstuff', name: 'BeachStuff', icon: <Box className="h-3.5 w-3.5 text-muted-foreground" /> },
              { id: 'grass', name: 'Grass', icon: <TreePine className="h-3.5 w-3.5 text-green-400" /> },
              { id: 'helicopter', name: 'Helicopter', icon: <Box className="h-3.5 w-3.5 text-muted-foreground" /> },
            ],
          },
          {
            id: 'materials',
            name: 'Materials',
            icon: <Folder className="h-3.5 w-3.5 text-yellow-500" />,
            expanded: true,
            children: [
              { id: 'beach_rocks_mat', name: 'beach_rocks_MAT', icon: <Palette className="h-3.5 w-3.5 text-purple-400" /> },
              { id: 'eco_sand', name: 'eco_sand_procedural_1', icon: <Palette className="h-3.5 w-3.5 text-purple-400" /> },
              { id: 'underwater', name: 'UnderWater', icon: <Palette className="h-3.5 w-3.5 text-purple-400" /> },
              { id: 'undersand', name: 'UnderSand', icon: <Palette className="h-3.5 w-3.5 text-purple-400" /> },
            ],
          },
        ],
      },
      { id: 'beach_overwater_shack', name: 'beach_overwater_shack', icon: <Box className="h-3.5 w-3.5 text-muted-foreground" /> },
      { id: 'beach_footbridge', name: 'beach_footbridge', icon: <Box className="h-3.5 w-3.5 text-muted-foreground" /> },
    ],
  },
]

interface TreeItemProps {
  node: TreeNode
  level: number
}

function TreeItem({ node, level }: TreeItemProps) {
  const [expanded, setExpanded] = useState(node.expanded ?? false)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 px-1 hover:bg-accent/50 rounded cursor-pointer text-sm select-none"
        style={{ paddingLeft: `${level * 12 + 4}px` }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        {node.icon}
        <span className="text-foreground/90 truncate">{node.name}</span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SceneHierarchy() {
  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="px-3 py-2 border-b border-border">
        <div className="inline-flex items-center px-3 py-1 bg-primary/20 rounded text-xs font-medium text-primary">
          Scene
        </div>
      </div>
      <div className="flex-1 overflow-auto p-1">
        {sceneData.map((node) => (
          <TreeItem key={node.id} node={node} level={0} />
        ))}
      </div>
    </div>
  )
}
