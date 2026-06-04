'use client'

import { ChevronDown, ChevronRight, Settings } from 'lucide-react'
import { useState } from 'react'

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
      <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

export function Inspector() {
  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Scene</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Timeline slider placeholder */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
            <div className="flex-1 h-1 bg-muted rounded-full">
              <div className="w-0 h-full bg-primary rounded-full" />
            </div>
            <div className="w-2 h-2 rounded-full bg-muted-foreground" />
          </div>
        </div>

        <InspectorSection title="Layer Data">
          <PropertyRow label="Default Prim">
            <select className="w-full bg-input border border-border rounded px-2 py-1 text-xs">
              <option>Root</option>
              <option>GlobalScale</option>
            </select>
          </PropertyRow>
          <PropertyRow label="Meters Per Unit">
            <input
              type="number"
              defaultValue={1}
              className="w-full bg-input border border-border rounded px-2 py-1 text-xs"
            />
          </PropertyRow>
          <PropertyRow label="Up Axis">
            <select className="w-full bg-input border border-border rounded px-2 py-1 text-xs">
              <option>Y</option>
              <option>Z</option>
            </select>
          </PropertyRow>
          <div className="flex items-center gap-2 py-1 mt-1">
            <input type="checkbox" id="convert-variants" className="rounded" />
            <label htmlFor="convert-variants" className="text-xs text-muted-foreground">
              Convert Variants to Configurations
            </label>
          </div>
        </InspectorSection>

        <InspectorSection title="Transform" defaultExpanded={false}>
          <PropertyRow label="Position">
            <div className="flex gap-1">
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="X" />
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Y" />
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Z" />
            </div>
          </PropertyRow>
          <PropertyRow label="Rotation">
            <div className="flex gap-1">
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="X" />
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Y" />
              <input type="number" defaultValue={0} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Z" />
            </div>
          </PropertyRow>
          <PropertyRow label="Scale">
            <div className="flex gap-1">
              <input type="number" defaultValue={1} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="X" />
              <input type="number" defaultValue={1} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Y" />
              <input type="number" defaultValue={1} className="w-full bg-input border border-border rounded px-2 py-1 text-xs" placeholder="Z" />
            </div>
          </PropertyRow>
        </InspectorSection>
      </div>
    </div>
  )
}
