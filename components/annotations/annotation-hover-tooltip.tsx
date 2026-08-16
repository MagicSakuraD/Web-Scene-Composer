'use client'

import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import {
  annotationHoverAtom,
  bindAnnotationHoverTooltipEl,
} from '@/lib/annotations/hover'

/** HTML overlay tooltip (Foxglove-style category on hover). */
export function AnnotationHoverTooltip() {
  const hover = useAtomValue(annotationHoverAtom)
  const elRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bindAnnotationHoverTooltipEl(elRef.current)
    return () => bindAnnotationHoverTooltipEl(null)
  }, [hover])

  if (!hover) return null

  const categoryLine = hover.label.startsWith('category:')
    ? hover.label
    : `category: ${hover.label}`

  return (
    <div
      ref={elRef}
      className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-border/80 bg-zinc-950/90 px-2.5 py-1.5 text-[11px] leading-snug text-zinc-100 shadow-lg backdrop-blur-sm"
      style={{
        left: hover.clientX + 14,
        top: hover.clientY + 14,
      }}
    >
      {hover.topic ? (
        <div className="font-mono text-[10px] text-zinc-400 truncate">{hover.topic}</div>
      ) : null}
      <div className="font-mono text-zinc-50">{categoryLine}</div>
    </div>
  )
}
