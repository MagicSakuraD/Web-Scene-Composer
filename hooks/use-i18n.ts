'use client'

import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { localeAtom } from '@/lib/i18n/locale-atom'
import {
  localeLabels,
  locales,
  translate,
  type Locale,
  type MessageKey,
} from '@/lib/i18n/messages'

export function useI18n() {
  const [locale, setLocale] = useAtom(localeAtom)

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string>) => translate(locale, key, params),
    [locale],
  )

  const toggleLocale = useCallback(() => {
    const idx = locales.indexOf(locale)
    setLocale(locales[(idx + 1) % locales.length]!)
  }, [locale, setLocale])

  return { locale, setLocale, toggleLocale, t, localeLabel: localeLabels[locale] }
}

export type { Locale, MessageKey }
