'use client'

import { useAtomValue } from 'jotai'
import { simulateLogsAtom, simulateStatusAtom, simulateErrorAtom } from '@/lib/ros/atoms'
import { projectAssetsAtom } from '@/lib/scene/atoms'
import { cn } from '@/lib/utils'

export function ConsolePanel() {
  const logs = useAtomValue(simulateLogsAtom)
  const status = useAtomValue(simulateStatusAtom)
  const error = useAtomValue(simulateErrorAtom)
  const assets = useAtomValue(projectAssetsAtom)

  return (
    <div className="p-3 font-mono text-xs text-muted-foreground space-y-1">
      <p className="text-green-600 dark:text-green-400">[Ready] Web Scene Composer</p>
      <p>[Info] Simulate: {status}{error ? ` — ${error}` : ''}</p>
      <p>[Info] Imported assets: {assets.length}</p>
      <div className="border-t border-border my-2 pt-2 space-y-0.5">
        {logs.length === 0 ? (
          <p className="text-muted-foreground/70">No runtime logs yet. Click Simulate to connect.</p>
        ) : (
          logs.map((row) => (
            <p
              key={row.id}
              className={cn(
                row.level === 'error' && 'text-red-500',
                row.level === 'warn' && 'text-amber-500',
                row.level === 'info' && 'text-muted-foreground',
              )}
            >
              [{row.time}] [{row.level.toUpperCase()}] {row.message}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
