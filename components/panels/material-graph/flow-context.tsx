'use client'

import { createContext, useContext } from 'react'

type MaterialGraphFlowContextValue = {
  onNodeDataChange: (nodeId: string, patch: Record<string, string | number | boolean>) => void
}

export const MaterialGraphFlowContext = createContext<MaterialGraphFlowContextValue | null>(
  null,
)

export function useMaterialGraphFlow() {
  const ctx = useContext(MaterialGraphFlowContext)
  if (!ctx) throw new Error('useMaterialGraphFlow must be used within MaterialGraphFlow')
  return ctx
}
