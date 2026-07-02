'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

type HelpSection = {
  titleKey: 'help.section.viewport' | 'help.section.transform' | 'help.section.scene'
  items: Array<
    | 'help.viewport.lmb'
    | 'help.viewport.mmb'
    | 'help.viewport.wheel'
    | 'help.viewport.rmbFly'
    | 'help.viewport.frame'
    | 'help.viewport.contextMenu'
    | 'help.transform.gizmo'
    | 'help.transform.toolbar'
    | 'help.transform.space'
    | 'help.scene.hierarchy'
    | 'help.scene.inspector'
  >
}

const HELP_SECTIONS: HelpSection[] = [
  {
    titleKey: 'help.section.viewport',
    items: [
      'help.viewport.lmb',
      'help.viewport.mmb',
      'help.viewport.wheel',
      'help.viewport.rmbFly',
      'help.viewport.frame',
      'help.viewport.contextMenu',
    ],
  },
  {
    titleKey: 'help.section.transform',
    items: ['help.transform.gizmo', 'help.transform.toolbar', 'help.transform.space'],
  },
  {
    titleKey: 'help.section.scene',
    items: ['help.scene.hierarchy', 'help.scene.inspector'],
  },
]

export function InteractionHelpButton() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  return (
    <>
      <button
        type="button"
        className="p-1.5 rounded hover:bg-accent text-toolbar-foreground transition-colors"
        title={t('titleBar.help')}
        aria-label={t('titleBar.help')}
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40"
            onMouseDown={close}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="interaction-help-title"
              className={cn(
                'relative w-full max-w-lg max-h-[min(80vh,560px)] overflow-hidden',
                'rounded-lg border border-border bg-popover shadow-xl flex flex-col',
              )}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
                <HelpCircle className="h-4 w-4 text-primary" />
                <h2 id="interaction-help-title" className="text-sm font-semibold flex-1">
                  {t('help.title')}
                </h2>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-accent text-muted-foreground"
                  title={t('help.close')}
                  aria-label={t('help.close')}
                  onClick={close}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {HELP_SECTIONS.map((section) => (
                  <section key={section.titleKey}>
                    <h3 className="text-xs font-semibold text-foreground mb-2">
                      {t(section.titleKey)}
                    </h3>
                    <ul className="space-y-1.5">
                      {section.items.map((itemKey) => (
                        <li
                          key={itemKey}
                          className="text-xs text-muted-foreground leading-relaxed pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-muted-foreground/60"
                        >
                          {t(itemKey)}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              <div className="px-4 py-3 border-t border-border shrink-0 flex justify-end">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:opacity-90"
                  onClick={close}
                >
                  {t('help.close')}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
