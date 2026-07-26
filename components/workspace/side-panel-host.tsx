'use client'

import { MoreVertical } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { leftSidePanelAtom, rightSidePanelAtom } from '@/lib/workspace/atoms'
import { getSidePanelDef } from '@/lib/workspace/side-panel-registry'
import type { SideSlot } from '@/lib/workspace/types'
import { SidePanelContent } from '@/components/workspace/side-panel-content'
import {
  PanelChangeMenu,
  usePanelMenuAnchor,
} from '@/components/workspace/panel-change-menu'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

interface SidePanelHostProps {
  slot: SideSlot
  className?: string
  rail?: React.ReactNode
}

export function SidePanelHost({ slot, className, rail }: SidePanelHostProps) {
  const { t } = useI18n()
  const panelType = useAtomValue(slot === 'left' ? leftSidePanelAtom : rightSidePanelAtom)
  const def = getSidePanelDef(panelType)
  const { buttonRef, open, toggle, close, anchorRect } = usePanelMenuAnchor()

  return (
    <div className={cn('h-full min-h-0 flex flex-col bg-sidebar/80', className)}>
      <div className="flex items-center gap-1 shrink-0 border-b border-border bg-panel-header px-2 py-1.5">
        <span className="flex-1 truncate text-xs font-medium text-foreground">
          {t(def.nameKey)}
        </span>
        <button
          ref={buttonRef}
          type="button"
          className="p-1 rounded hover:bg-accent text-muted-foreground"
          title={t('sidePanel.menu')}
          aria-expanded={open}
          onClick={toggle}
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {slot === 'right' && rail}
        <div className="flex-1 min-w-0 overflow-hidden">
          <SidePanelContent type={panelType} />
        </div>
        {slot === 'left' && rail}
      </div>

      <PanelChangeMenu
        slot={slot}
        currentType={panelType}
        open={open}
        anchorRect={anchorRect}
        onClose={close}
      />
    </div>
  )
}
