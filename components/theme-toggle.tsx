'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useI18n } from '@/hooks/use-i18n'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-1.5 rounded hover:bg-accent text-toolbar-foreground transition-colors"
      title={
        mounted
          ? isDark
            ? t('theme.toggleLight')
            : t('theme.toggleDark')
          : t('theme.toggle')
      }
      aria-label={t('theme.toggle')}
    >
      {!mounted ? (
        <Sun className="h-4 w-4" />
      ) : isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  )
}
