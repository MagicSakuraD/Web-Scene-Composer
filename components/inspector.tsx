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
import { rosPositionToThree, threePositionToRos } from '@/lib/ros/ros-three-coords'
import { NAV_MAP_FRAME } from '@/lib/ros/nav-goal-config'
import { useI18n } from '@/hooks/use-i18n'

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

function threePosToMapFrame(pos: [number, number, number]): [number, number, number] {
  const ros = threePositionToRos(pos[0], pos[1], pos[2])
  return [ros.x, ros.y, ros.z]
}

function mapFrameToThreePos(pos: [number, number, number]): [number, number, number] {
  const three = rosPositionToThree(pos[0], pos[1], pos[2])
  return [three.x, three.y, three.z]
}

export function Inspector() {
  const { t } = useI18n()
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
          <span className="text-sm font-medium text-muted-foreground">{t('inspector.title')}</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-muted-foreground text-center">
            {t('inspector.noSelection')}
          </p>
        </div>
      </div>
    )
  }

  const isLight = node.type === 'distant-light' || node.type === 'point-light'
  const isPhysicalLight = node.type === 'physical-distant-light'
  const isAsset = node.type === 'asset-ref'
  const isGltfPrim = node.type === 'gltf-prim'
  const isNavWaypoint = node.type === 'nav-waypoint'
  const showTransform =
    node.type !== 'group' && node.type !== 'ground' && !isGltfPrim

  const positionValues = isNavWaypoint
    ? threePosToMapFrame(node.transform.position)
    : node.transform.position

  const handlePositionChange = (axis: 0 | 1 | 2, value: number) => {
    if (!node) return
    if (isNavWaypoint) {
      const mapPos = threePosToMapFrame(node.transform.position)
      mapPos[axis] = value
      const threePos = mapFrameToThreePos(mapPos)
      setTransform({ id: node.id, transform: { position: threePos } })
      return
    }
    updateAxis('position', axis, value)
  }

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
          <InspectorSection title={t('inspector.transform')}>
            <PropertyRow label={t('inspector.position')}>
              <VectorInput
                values={positionValues}
                onChange={handlePositionChange}
              />
            </PropertyRow>
            {isNavWaypoint && (
              <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                {t('inspector.navWaypointPositionHint')} ({NAV_MAP_FRAME})
              </p>
            )}
            <PropertyRow label={t('inspector.rotation')}>
              <VectorInput
                values={node.transform.rotation}
                onChange={(axis, v) => updateAxis('rotation', axis, v)}
              />
            </PropertyRow>
            <PropertyRow label={t('inspector.scale')}>
              <VectorInput
                values={node.transform.scale}
                onChange={(axis, v) => updateAxis('scale', axis, v)}
                defaultValue={1}
              />
            </PropertyRow>
          </InspectorSection>
        )}

        {(isLight || isPhysicalLight) && (
          <InspectorSection title={t('inspector.lightProperties')}>
            <PropertyRow label={t('inspector.intensity')}>
              <input
                type="number"
                step="0.1"
                min="0"
                value={node.lightIntensity ?? (isPhysicalLight ? 1.15 : 1)}
                onChange={(e) =>
                  setProps({
                    id: node.id,
                    props: { lightIntensity: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
              />
            </PropertyRow>
            <PropertyRow label={t('inspector.color')}>
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
          <InspectorSection title={t('inspector.assetReference')}>
            <PropertyRow label={t('inspector.format')}>
              <span className="text-xs text-muted-foreground">{t('projectBrowser.gltfFormat')}</span>
            </PropertyRow>
            <PropertyRow label={t('inspector.url')}>
              <span className="text-xs text-muted-foreground truncate block" title={node.assetUrl}>
                {node.assetUrl ?? t('inspector.none')}
              </span>
            </PropertyRow>
            <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
              {t('inspector.assetHierarchyHint')}
            </p>
          </InspectorSection>
        )}

        {isGltfPrim && (
          <>
            <InspectorSection title={t('inspector.prim')}>
              <PropertyRow label={t('inspector.kind')}>
                <span className="text-xs font-medium">{node.gltfKind}</span>
              </PropertyRow>
              <PropertyRow label={t('inspector.path')}>
                <span className="text-xs text-muted-foreground font-mono truncate block" title={node.gltfPath}>
                  /{node.gltfPath}
                </span>
              </PropertyRow>
            </InspectorSection>
            <InspectorSection title={t('inspector.transform')} defaultExpanded={false}>
              <PropertyRow label={t('inspector.position')}>
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.position.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <PropertyRow label={t('inspector.rotation')}>
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.rotation.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <PropertyRow label={t('inspector.scale')}>
                <span className="text-xs text-muted-foreground font-mono">
                  {node.transform.scale.map((v) => v.toFixed(2)).join(', ')}
                </span>
              </PropertyRow>
              <p className="text-[10px] text-muted-foreground mt-1">
                {t('inspector.gltfPrimTransformHint')}
              </p>
            </InspectorSection>
          </>
        )}
      </div>
    </div>
  )
}
