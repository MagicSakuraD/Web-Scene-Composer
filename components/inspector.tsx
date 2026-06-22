'use client'

import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  selectedNodeAtom,
  updateNodeTransformAtom,
  updateNodePropsAtom,
} from '@/lib/scene/atoms'
import { getNodeIcon } from '@/lib/scene/node-icons'
import type { Transform } from '@/lib/scene/types'

interface InspectorSectionProps {
  title: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

function InspectorSection({ title, defaultExpanded = true, children }: InspectorSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="border-b border-border">
      <button
        className="w-full flex items-center gap-1 px-3 py-2 hover:bg-accent/50 text-sm font-medium"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        {title}
      </button>
      {expanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

interface PropertyRowProps {
  label: string
  children: React.ReactNode
}

function PropertyRow({ label, children }: PropertyRowProps) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface VectorInputProps {
  values: [number, number, number]
  onChange: (axis: 0 | 1 | 2, value: number) => void
  defaultValue?: number
}

function VectorInput({ values, onChange, defaultValue = 0 }: VectorInputProps) {
  const labels = ['X', 'Y', 'Z'] as const

  return (
    <div className="flex gap-1">
      {labels.map((label, i) => (
        <div key={label} className="flex-1 flex flex-col gap-0.5">
          <span className="text-[10px] text-muted-foreground">{label}</span>
          <input
            type="number"
            step="0.1"
            value={Number(values[i].toFixed(2))}
            onChange={(e) => onChange(i as 0 | 1 | 2, parseFloat(e.target.value) || defaultValue)}
            className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
          />
        </div>
      ))}
    </div>
  )
}

export function Inspector() {
  const node = useAtomValue(selectedNodeAtom)
  const setTransform = useSetAtom(updateNodeTransformAtom)
  const setProps = useSetAtom(updateNodePropsAtom)

  const updateAxis = (
    field: keyof Transform,
    axis: 0 | 1 | 2,
    value: number,
  ) => {
    if (!node) return
    const current = node.transform[field] as [number, number, number]
    const updated = [...current] as [number, number, number]
    updated[axis] = value
    setTransform({ id: node.id, transform: { [field]: updated } })
  }

  if (!node) {
    return (
      <div className="h-full flex flex-col bg-sidebar flex-1 min-w-0">
        <div className="px-3 py-2 border-b border-border">
          <span className="text-sm font-medium text-muted-foreground">Inspector</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            Select an object to inspect its properties.
          </p>
        </div>
      </div>
    )
  }

  const isLight = node.type === 'distant-light' || node.type === 'point-light'
  const isAsset = node.type === 'asset-ref'
  const isGltfPrim = node.type === 'gltf-prim'
  const showTransform =
    node.type !== 'group' && node.type !== 'ground' && !isGltfPrim

  return (
    <div className="h-full flex flex-col bg-sidebar flex-1 min-w-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        {getNodeIcon(node)}
        <span className="text-sm font-medium flex-1 truncate">{node.name}</span>
        <button className="p-1 rounded hover:bg-accent text-muted-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {showTransform && (
          <InspectorSection title="Transform">
            <PropertyRow label="Position">
              <VectorInput
                values={node.transform.position}
                onChange={(axis, v) => updateAxis('position', axis, v)}
              />
            </PropertyRow>
            <PropertyRow label="Rotation">
              <VectorInput
                values={node.transform.rotation}
                onChange={(axis, v) => updateAxis('rotation', axis, v)}
              />
            </PropertyRow>
            <PropertyRow label="Scale">
              <VectorInput
                values={node.transform.scale}
                onChange={(axis, v) => updateAxis('scale', axis, v)}
                defaultValue={1}
              />
            </PropertyRow>
          </InspectorSection>
        )}

        {isLight && (
          <InspectorSection title="Light Properties">
            <PropertyRow label="Intensity">
              <input
                type="number"
                step="0.1"
                min="0"
                value={node.lightIntensity ?? 1}
                onChange={(e) =>
                  setProps({
                    id: node.id,
                    props: { lightIntensity: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
              />
            </PropertyRow>
            <PropertyRow label="Color">
              <input
                type="color"
                value={node.lightColor ?? '#ffffff'}
                onChange={(e) =>
                  setProps({ id: node.id, props: { lightColor: e.target.value } })
                }
                className="w-full h-7 bg-input border border-border rounded cursor-pointer"
              />
            </PropertyRow>
          </InspectorSection>
        )}

        {isAsset && (
          <InspectorSection title="Asset Reference">
            <PropertyRow label="Format">
              <span className="text-xs text-muted-foreground">glTF / GLB</span>
            </PropertyRow>
            <PropertyRow label="URL">
              <span className="text-xs text-muted-foreground truncate block" title={node.assetUrl}>
                {node.assetUrl ?? 'None'}
              </span>
            </PropertyRow>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              Internal mesh/group hierarchy is expanded in the Scene outliner (gltfjsx-style graph).
            </p>
          </InspectorSection>
        )}

        {isGltfPrim && (
          <>
            <InspectorSection title="Prim">
              <PropertyRow label="Kind">
                <span className="text-xs font-medium">{node.gltfKind}</span>
              </PropertyRow>
              <PropertyRow label="Path">
                <span className="text-xs text-muted-foreground font-mono truncate block" title={node.gltfPath}>
                  /{node.gltfPath}
                </span>
              </PropertyRow>
            </InspectorSection>
            <InspectorSection title="Transform" defaultExpanded={false}>
              <PropertyRow label="Position">
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.position.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <PropertyRow label="Rotation">
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.rotation.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <PropertyRow label="Scale">
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.scale.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <p className="text-[10px] text-muted-foreground mt-1">
                Local transform from glTF. Edit the parent asset-ref to move the whole model.
              </p>
            </InspectorSection>
          </>
        )}
      </div>
    </div>
  )
}
