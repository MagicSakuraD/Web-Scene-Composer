import type { SimulateLogEntry } from './atoms'

export function appendSimulateLog(
  prev: SimulateLogEntry[],
  entry: Omit<SimulateLogEntry, 'id' | 'time'>,
): SimulateLogEntry[] {
  const row: SimulateLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toLocaleTimeString(),
  }
  return [...prev.slice(-199), row]
}
