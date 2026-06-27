'use client'

import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { localeAtom } from '@/lib/i18n/locale-atom'

/** 将 jotai 语言同步到 <html lang>，便于无障碍与浏览器翻译 */
export function I18nSync() {
  const locale = useAtomValue(localeAtom)

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  return null
}
