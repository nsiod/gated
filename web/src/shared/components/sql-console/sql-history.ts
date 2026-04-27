// localStorage-backed SQL query history for the DatabaseConsole. Pure
// browser-only storage; history is scoped per target name so switching
// targets doesn't cross-contaminate the recent-queries list.

const HISTORY_KEY_PREFIX = 'gated:sql-history:'
export const HISTORY_MAX = 50

export interface HistoryEntry {
  id: string
  sql: string
  at: number
  elapsedMs?: number
  rows?: number
  error?: string
}

function historyKey(target: string): string {
  return `${HISTORY_KEY_PREFIX}${target}`
}

export function loadHistory(target: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(historyKey(target))
    if (raw == null)
      return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    return Array.isArray(parsed) ? parsed : []
  }
  catch {
    return []
  }
}

export function saveHistory(target: string, entries: HistoryEntry[]): void {
  try {
    const trimmed = entries.slice(0, HISTORY_MAX)
    localStorage.setItem(historyKey(target), JSON.stringify(trimmed))
  }
  catch {
    /* quota exceeded — ignore */
  }
}
