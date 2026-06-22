'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PanelCollapseRailProps {
  side: 'left' | 'right'
  isOpen: boolean
  onToggle: () => void
}

export function PanelCollapseRail({ side, isOpen, onToggle }: PanelCollapseRailProps) {
  return (
    <button
      className={cn(
        'absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center',
        'w-4 h-10 rounded-sm border border-border bg-card/90 hover:bg-accent',
        'text-muted-foreground hover:text-foreground shadow-sm transition-colors',
        side === 'left' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
      )}
      onClick={onToggle}
      title={isOpen ? '折叠面板' : '展开面板'}
    >
      {side === 'left' ? (
        isOpen ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
      ) : isOpen ? (
        <ChevronRight className="h-3 w-3" />
      ) : (
        <ChevronLeft className="h-3 w-3" />
      )}
    </button>
  )
}
