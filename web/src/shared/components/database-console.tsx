import type { HistoryEntry } from './sql-console/sql-history'
import type { SqlEditorHandle, SqlEditorMonaco } from './sql-editor'
import type { DbQueryResponse } from '@/features/gateway/lib/api-client'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, History, Play } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/features/gateway/lib/api'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTheme } from '@/shared/hooks/use-theme'
import { cn } from '@/shared/lib/utils'
import { errorMessage } from './sql-console/error-message'
import { ResultGrid } from './sql-console/result-grid'
import { SchemaNode } from './sql-console/schema-tree'
import { HISTORY_MAX, loadHistory, saveHistory } from './sql-console/sql-history'

const SqlEditor = lazy(async () => import('./sql-editor'))

const DEFAULT_LIMIT = 1000

interface DatabaseConsoleProps {
  kind: 'mysql' | 'postgres'
  targetName: string
}

export function DatabaseConsole({ kind, targetName }: DatabaseConsoleProps) {
  const { t } = useTranslation('gateway')
  const { theme } = useTheme()

  const [sql, setSql] = useState<string>('SELECT 1;')
  const [limit, setLimit] = useState<number>(DEFAULT_LIMIT)
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({})
  const [tab, setTab] = useState<'results' | 'history'>('results')
  const [result, setResult] = useState<DbQueryResponse | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(targetName))
  const [consoleSessionKey] = useState(() => globalThis.crypto.randomUUID())
  const editorRef = useRef<SqlEditorHandle | null>(null)

  const schemasQuery = useQuery({
    queryKey: ['sql', 'schemas', targetName],
    queryFn: async () => api.getDbSchemas(targetName),
    retry: false,
    staleTime: 60_000,
  })

  useEffect(() => {
    const def = schemasQuery.data?.default_schema
    if (def != null && def !== '') {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setExpandedSchemas(prev => (prev[def] != null ? prev : { ...prev, [def]: true }))
    }
  }, [schemasQuery.data?.default_schema])

  const runMutation = useMutation({
    mutationFn: async (variables: { sql: string, limit: number }) =>
      api.runDbQuery(targetName, {
        sql: variables.sql,
        limit: variables.limit,
        console_session_key: consoleSessionKey,
      }),
  })

  const executeQuery = useCallback(async (override?: string) => {
    const effectiveSql = (override ?? sql).trim()
    if (effectiveSql === '')
      return
    setErrorText(null)
    const started = Date.now()
    const entry: HistoryEntry = {
      id: `${String(started)}-${Math.random().toString(36).slice(2, 8)}`,
      sql: effectiveSql,
      at: started,
    }
    try {
      const resp = await runMutation.mutateAsync({ sql: effectiveSql, limit })
      setResult(resp)
      setTab('results')
      entry.elapsedMs = resp.elapsed_ms
      entry.rows = resp.rows.length
    }
    catch (err) {
      const msg = await errorMessage(err)
      setErrorText(msg)
      setResult(null)
      entry.error = msg
    }
    setHistory((prev) => {
      const next = [entry, ...prev.filter(e => e.id !== entry.id)]
      saveHistory(targetName, next)
      return next.slice(0, HISTORY_MAX)
    })
  }, [consoleSessionKey, sql, limit, runMutation, targetName])

  const handleEditorMount = (editor: SqlEditorHandle, monaco: SqlEditorMonaco) => {
    editorRef.current = editor
    // eslint-disable-next-line ts/no-unsafe-member-access
    const binding: number = monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter
    editor.addCommand(binding, () => {
      void executeQuery(editor.getValue())
    })
  }

  const quoteIdent = (name: string): string => {
    if (kind === 'mysql')
      return `\`${name.replaceAll('`', '``')}\``
    return `"${name.replaceAll('"', '""')}"`
  }

  const insertTableInEditor = (schema: string, table: string) => {
    const snippet = `SELECT *\nFROM ${quoteIdent(schema)}.${quoteIdent(table)}\nLIMIT 100;`
    if (editorRef.current != null) {
      const selection = editorRef.current.getSelection()
      if (selection != null) {
        editorRef.current.executeEdits('sql-console', [
          { range: selection, text: snippet, forceMoveMarkers: true },
        ])
        editorRef.current.focus()
        return
      }
    }
    setSql(snippet)
  }

  const pickFromHistory = (entry: HistoryEntry) => {
    setSql(entry.sql)
    setTab('results')
    editorRef.current?.focus()
  }

  const clearHistory = () => {
    saveHistory(targetName, [])
    setHistory([])
  }

  const schemas = schemasQuery.data?.schemas ?? []

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r bg-muted/30 p-2">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            {t('sqlConsole.schemas')}
          </div>
          {schemasQuery.isPending && <Skeleton className="h-8 w-full" />}
          {schemasQuery.isError && (
            <div className="text-xs text-destructive">
              {t('sqlConsole.schemaLoadError')}
            </div>
          )}
          {schemas.map(s => (
            <SchemaNode
              key={s}
              target={targetName}
              schema={s}
              expanded={expandedSchemas[s] ?? false}
              onToggle={() => setExpandedSchemas(prev => ({ ...prev, [s]: !(prev[s] ?? false) }))}
              onInsertTable={insertTableInEditor}
            />
          ))}
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
            <Button
              size="sm"
              onClick={() => { void executeQuery() }}
              disabled={runMutation.isPending}
            >
              <Play className="size-3.5" />
              {runMutation.isPending ? t('sqlConsole.running') : t('sqlConsole.run')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('sqlConsole.shortcut')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-muted-foreground">
                {t('sqlConsole.limit')}
              </label>
              <Input
                type="number"
                min={1}
                max={10_000}
                value={limit}
                onChange={e => setLimit(Math.max(1, Math.min(10_000, Number(e.target.value) || DEFAULT_LIMIT)))}
                className="h-7 w-24"
              />
            </div>
          </div>

          <div className="h-1/2 min-h-[140px] border-b">
            <Suspense fallback={<Skeleton className="h-full w-full rounded-none" />}>
              <SqlEditor
                theme={theme}
                value={sql}
                onChange={setSql}
                onMount={handleEditorMount}
              />
            </Suspense>
          </div>

          <div className="flex items-center gap-1 border-b bg-muted/30 px-3 py-1 text-xs">
            <button
              type="button"
              onClick={() => setTab('results')}
              className={cn(
                'rounded px-2 py-1',
                tab === 'results' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t('sqlConsole.results')}
              {result != null && (
                <span className="ml-1 text-muted-foreground">
                  (
                  {result.rows.length}
                  )
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1',
                tab === 'history' ? 'bg-background font-semibold shadow-sm' : 'text-muted-foreground',
              )}
            >
              <History className="size-3" />
              {t('sqlConsole.history')}
              {history.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  (
                  {history.length}
                  )
                </span>
              )}
            </button>
            {result != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                {result.elapsed_ms}
                ms ·
                {' '}
                {result.statement_kind}
                {result.truncated && (
                  <span className="ml-2 inline-flex items-center gap-1 text-warning-foreground">
                    <AlertTriangle className="size-3" />
                    {t('sqlConsole.truncated')}
                  </span>
                )}
              </span>
            )}
          </div>

          <section className="flex-1 overflow-auto bg-background">
            {errorText != null && (
              <div className="m-3 rounded border border-destructive bg-destructive/10 p-2 font-mono text-xs text-destructive whitespace-pre-wrap">
                {errorText}
              </div>
            )}
            {tab === 'results' && result != null && <ResultGrid data={result} />}
            {tab === 'results' && result == null && errorText == null && (
              <div className="p-4 text-sm text-muted-foreground">
                {t('sqlConsole.runPrompt')}
              </div>
            )}
            {tab === 'history' && (
              <div className="p-2">
                {history.length === 0
                  ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        {t('sqlConsole.historyEmpty')}
                      </div>
                    )
                  : (
                      <>
                        <div className="flex justify-end pb-2">
                          <Button size="sm" variant="ghost" onClick={clearHistory}>
                            {t('sqlConsole.clearHistory')}
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {history.map(entry => (
                            <button
                              type="button"
                              key={entry.id}
                              onClick={() => pickFromHistory(entry)}
                              className="block w-full rounded border px-2 py-1.5 text-left text-xs hover:bg-accent"
                            >
                              <div className="font-mono text-foreground whitespace-pre-wrap line-clamp-3">
                                {entry.sql}
                              </div>
                              <div className="mt-1 flex items-center gap-3 text-muted-foreground">
                                <span>{new Date(entry.at).toLocaleString()}</span>
                                {entry.elapsedMs != null && (
                                  <span>
                                    {entry.elapsedMs}
                                    ms
                                  </span>
                                )}
                                {entry.rows != null && (
                                  <span>
                                    {entry.rows}
                                    {' '}
                                    rows
                                  </span>
                                )}
                                {entry.error != null && (
                                  <span className="text-destructive">✗</span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}
