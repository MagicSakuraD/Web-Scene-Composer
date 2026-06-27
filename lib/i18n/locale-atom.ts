import { atomWithStorage } from 'jotai/utils'
import type { Locale } from './messages'

export const localeAtom = atomWithStorage<Locale>('wsc-locale', 'zh')
