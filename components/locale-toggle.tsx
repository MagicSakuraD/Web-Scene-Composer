'use client'

import { Languages } from 'lucide-react'
import { useI18n } from '@/hooks/use-i18n'
import { cn } from '@/lib/utils'

export function LocaleToggle() {
  const { locale, toggleLocale, t, localeLabel } = useI18n()

  return (
    <button
      onClick={toggleLocale}
      className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-accent text-toolbar-foreground transition-colors text-xs font-medium min-w-[2.75rem]"
      title={t('titleBar.locale')}
      aria-label={t('titleBar.locale')}
    >
      <Languages className="h-4 w-4 shrink-0" />
      <span className={cn(locale === 'zh' ? 'tracking-wide' : '')}>{localeLabel.slice(0, 2)}</span>
    </button>
  )
}
