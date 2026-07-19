'use client'

import { useEffect } from 'react'
import { undo, redo } from '@/lib/scene/history'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

/** 全局撤销 / 重做快捷键：Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做 */
export function SceneHistoryShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      // 文本输入 / 可编辑元素内交给浏览器原生撤销
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()
      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}
