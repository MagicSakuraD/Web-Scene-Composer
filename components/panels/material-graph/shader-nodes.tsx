'use client'

import { useContext, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Box,
  CircleDot,
  GitMerge,
  Layers,
  Plus,
  Sparkles,
  Grid3x3,
  Hash,
  Blend,
  ImagePlus,
  X,
} from 'lucide-react'
import type { MaterialGraphNodeType } from '@/lib/material-graph/types'
import { NODE_PORTS } from '@/lib/material-graph/types'
import type { ShaderFlowNodeData } from '@/lib/material-graph/flow-adapters'
import {
  preloadMaterialGraphTexture,
  releaseMaterialGraphTexture,
  revokeMaterialGraphBlobUrl,
} from '@/lib/material-graph/texture-cache'
import { MaterialGraphFlowContext } from './flow-context'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

function accentClass(nodeType: MaterialGraphNodeType) {
  if (nodeType === 'output') return 'shader-graph-node-accent-blue'
  return 'shader-graph-node-accent-purple'
}

const NODE_ICON: Partial<Record<MaterialGraphNodeType, React.ReactNode>> = {
  texture: <Box className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  color: <CircleDot className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  float: <Hash className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  uv: <Grid3x3 className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  multiply: <GitMerge className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  add: <Plus className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  mix: <Blend className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  principled: <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-purple)]" />,
  output: <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--shader-graph-accent-blue)]" />,
}

function useMaterialGraphFlowSafe() {
  const ctx = useContext(MaterialGraphFlowContext)
  if (!ctx) return { onNodeDataChange: () => {} }
  return ctx
}

export function ShaderNodeShell({
  nodeType,
  title,
  subtitle,
  children,
}: {
  nodeType: MaterialGraphNodeType
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const ports = NODE_PORTS[nodeType]
  const inputs = ports.filter((p) => p.direction === 'in')
  const outputs = ports.filter((p) => p.direction === 'out')

  return (
    <div className="shader-graph-node-shell rounded-lg overflow-hidden shadow-sm border min-w-[228px] max-w-[292px] text-xs">
      <div className={cn('h-1 shrink-0', accentClass(nodeType))} />

      <div className="flex items-start gap-2 px-3 py-2 border-b border-[var(--shader-graph-node-border)]">
        {NODE_ICON[nodeType]}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold truncate leading-tight">{title}</p>
          {subtitle && (
            <p className="text-[9px] shader-graph-property-label truncate leading-tight mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {children ? (
        <div className="px-3 py-2 border-b border-[var(--shader-graph-node-border)] space-y-1.5">
          {children}
        </div>
      ) : null}

      {inputs.length > 0 && (
        <div className="py-0.5">
          {inputs.map((port) => (
            <div key={port.id} className="relative flex items-center h-7 px-3">
              <Handle
                id={port.id}
                type="target"
                position={Position.Left}
                className="shader-graph-handle !left-0 !top-1/2 !-translate-y-1/2"
              />
              <span className="text-[11px] shader-graph-property-label truncate pl-2">{port.label}</span>
            </div>
          ))}
        </div>
      )}

      {outputs.length > 0 && (
        <div className={cn('py-0.5', inputs.length > 0 && 'border-t border-[var(--shader-graph-node-border)]')}>
          {outputs.map((port) => (
            <div key={port.id} className="relative flex items-center justify-end h-7 px-3">
              <span className="text-[11px] shader-graph-property-label truncate pr-2">{port.label}</span>
              <Handle
                id={port.id}
                type="source"
                position={Position.Right}
                className="shader-graph-handle !right-0 !top-1/2 !-translate-y-1/2"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 nodrag nowheel">
      <span className="shader-graph-property-label shrink-0 text-[11px]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        className="w-[4.5rem] shader-graph-value-input border-0 rounded px-1.5 py-0.5 text-[11px] text-right font-mono tabular-nums"
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </label>
  )
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 nodrag nowheel">
      <span className="shader-graph-property-label shrink-0 text-[11px]">{label}</span>
      {children}
    </div>
  )
}

export function ShaderTextureNode({ id, data }: NodeProps<ShaderFlowNodeData>) {
  const { t } = useI18n()
  const { onNodeDataChange } = useMaterialGraphFlowSafe()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const imageUrl = String(data.imageUrl ?? '')
  const fileName = String(data.fileName ?? '')
  const fallbackHex = String(data.fallbackHex ?? '#8a9a7a')
  const hasImage = imageUrl.length > 0

  const replaceTexture = async (file: File) => {
    const nextUrl = URL.createObjectURL(file)
    try {
      await preloadMaterialGraphTexture(nextUrl)
    } catch {
      revokeMaterialGraphBlobUrl(nextUrl)
      return
    }

    if (imageUrl) {
      releaseMaterialGraphTexture(imageUrl)
      revokeMaterialGraphBlobUrl(imageUrl)
    }

    onNodeDataChange(id, {
      imageUrl: nextUrl,
      fileName: file.name,
      label: file.name,
    })
  }

  const clearTexture = () => {
    if (!imageUrl) return
    releaseMaterialGraphTexture(imageUrl)
    revokeMaterialGraphBlobUrl(imageUrl)
    onNodeDataChange(id, { imageUrl: '', fileName: '', label: 'Albedo Map' })
  }

  return (
    <ShaderNodeShell nodeType="texture" title={data.title}>
      <div className="flex gap-2.5 nodrag nopan nowheel">
        <button
          type="button"
          className="relative shrink-0 w-16 h-16 rounded-md border border-[var(--shader-graph-node-border)] overflow-hidden bg-[var(--shader-graph-value-input-bg)] hover:ring-2 hover:ring-[var(--shader-graph-accent-purple)]/40 transition-shadow"
          title={hasImage ? t('materialGraph.texture.replace') : t('materialGraph.texture.upload')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => fileInputRef.current?.click()}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
              <div className="w-8 h-8 rounded" style={{ backgroundColor: fallbackHex }} />
              <ImagePlus className="h-3.5 w-3.5 shader-graph-property-label" />
            </div>
          )}
        </button>

        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1.5">
          <p className="text-[11px] truncate font-medium">
            {fileName || String(data.label ?? 'Albedo Map')}
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="px-1.5 py-0.5 rounded text-[10px] shader-graph-value-input hover:opacity-90"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => fileInputRef.current?.click()}
            >
              {hasImage ? t('materialGraph.texture.replace') : t('materialGraph.texture.upload')}
            </button>
            {hasImage && (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] shader-graph-value-input hover:opacity-90"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={clearTexture}
              >
                <X className="h-3 w-3" />
                {t('materialGraph.texture.clear')}
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void replaceTexture(file)
          }}
        />
      </div>

      <PropertyRow label={t('materialGraph.texture.fallback')}>
        <input
          type="color"
          value={fallbackHex}
          className="h-5 w-8 rounded border border-[var(--shader-graph-node-border)] cursor-pointer bg-transparent"
          onChange={(e) => onNodeDataChange(id, { fallbackHex: e.target.value })}
        />
      </PropertyRow>
    </ShaderNodeShell>
  )
}

export function ShaderColorNode({ id, data }: NodeProps<ShaderFlowNodeData>) {
  const { onNodeDataChange } = useMaterialGraphFlowSafe()
  return (
    <ShaderNodeShell nodeType="color" title={data.title}>
      <PropertyRow label="Color">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={String(data.hex ?? '#ffffff')}
            className="h-5 w-8 rounded border border-[var(--shader-graph-node-border)] cursor-pointer bg-transparent"
            onChange={(e) => onNodeDataChange(id, { hex: e.target.value })}
          />
          <span className="font-mono text-[10px] shader-graph-property-label">
            {String(data.hex ?? '#ffffff')}
          </span>
        </div>
      </PropertyRow>
    </ShaderNodeShell>
  )
}

export function ShaderFloatNode({ id, data }: NodeProps<ShaderFlowNodeData>) {
  const { onNodeDataChange } = useMaterialGraphFlowSafe()
  const min = Number(data.min ?? 0)
  const max = Number(data.max ?? 1)
  return (
    <ShaderNodeShell nodeType="float" title={data.title}>
      <PropertyRow label="Value">
        <input
          type="number"
          step={0.01}
          min={min}
          max={max}
          value={Number(data.value ?? 0.5)}
          className="w-[4.5rem] shader-graph-value-input border-0 rounded px-1.5 py-0.5 text-[11px] text-right font-mono tabular-nums"
          onChange={(e) => onNodeDataChange(id, { value: parseFloat(e.target.value) || 0 })}
        />
      </PropertyRow>
    </ShaderNodeShell>
  )
}

export function ShaderUvNode({ data }: NodeProps<ShaderFlowNodeData>) {
  return (
    <ShaderNodeShell nodeType="uv" title={data.title}>
      <PropertyRow label="Channel">
        <span className="shader-graph-value-input rounded px-1.5 py-0.5 text-[11px] font-mono">
          {String(data.channel ?? 'uv0')}
        </span>
      </PropertyRow>
    </ShaderNodeShell>
  )
}

function ShaderMathBody({ title, nodeType, expr }: { title: string; nodeType: 'multiply' | 'add'; expr: string }) {
  return (
    <ShaderNodeShell nodeType={nodeType} title={title}>
      <PropertyRow label="Op">
        <span className="shader-graph-value-input rounded px-1.5 py-0.5 text-[11px] font-mono">{expr}</span>
      </PropertyRow>
    </ShaderNodeShell>
  )
}

export function ShaderMultiplyNode({ data }: NodeProps<ShaderFlowNodeData>) {
  return <ShaderMathBody title={data.title} nodeType="multiply" expr="A × B" />
}

export function ShaderAddNode({ data }: NodeProps<ShaderFlowNodeData>) {
  return <ShaderMathBody title={data.title} nodeType="add" expr="A + B" />
}

export function ShaderMixNode({ id, data }: NodeProps<ShaderFlowNodeData>) {
  const { onNodeDataChange } = useMaterialGraphFlowSafe()
  return (
    <ShaderNodeShell nodeType="mix" title={data.title}>
      <SliderRow
        label="Factor"
        value={Number(data.factor ?? 0.5)}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { factor: v })}
      />
    </ShaderNodeShell>
  )
}

export function ShaderPrincipledNode({ id, data }: NodeProps<ShaderFlowNodeData>) {
  const { onNodeDataChange } = useMaterialGraphFlowSafe()
  return (
    <ShaderNodeShell nodeType="principled" title="PreviewSurface" subtitle={data.title}>
      <SliderRow
        label="Roughness"
        value={Number(data.roughness ?? 0.5)}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { roughness: v })}
      />
      <SliderRow
        label="Metallic"
        value={Number(data.metalness ?? 0)}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { metalness: v })}
      />
      <SliderRow
        label="Transmission"
        value={Number(data.transmission ?? 0)}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { transmission: v })}
      />
      <SliderRow
        label="Clearcoat"
        value={Number(data.clearcoat ?? 0)}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { clearcoat: v })}
      />
      <SliderRow
        label="IOR"
        value={Number(data.ior ?? 1.5)}
        min={1}
        max={2.5}
        step={0.01}
        onChange={(v) => onNodeDataChange(id, { ior: v })}
      />
    </ShaderNodeShell>
  )
}

export function ShaderOutputNode({ data }: NodeProps<ShaderFlowNodeData>) {
  return (
    <ShaderNodeShell nodeType="output" title="Output" subtitle={String(data.subtitle ?? 'Material')}>
      <PropertyRow label="Surface">
        <span className="text-[11px] shader-graph-property-label">Custom Surface</span>
      </PropertyRow>
    </ShaderNodeShell>
  )
}

export const shaderNodeTypes = {
  texture: ShaderTextureNode,
  color: ShaderColorNode,
  float: ShaderFloatNode,
  uv: ShaderUvNode,
  multiply: ShaderMultiplyNode,
  add: ShaderAddNode,
  mix: ShaderMixNode,
  principled: ShaderPrincipledNode,
  output: ShaderOutputNode,
}
