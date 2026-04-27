import type { DbColumnInfo, DbTableInfo } from '@/features/gateway/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Database, Table as TableIcon } from 'lucide-react'
import { useState } from 'react'
import { api } from '@/features/gateway/lib/api'
import { cn } from '@/shared/lib/utils'

interface SchemaNodeProps {
  target: string
  schema: string
  expanded: boolean
  onToggle: () => void
  onInsertTable: (schema: string, table: string) => void
}

export function SchemaNode({ target, schema, expanded, onToggle, onInsertTable }: SchemaNodeProps) {
  const tablesQuery = useQuery({
    queryKey: ['sql', 'tables', target, schema],
    queryFn: async () => (await api.getDbTables(target, schema)).tables,
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1 rounded px-1.5 py-1 text-sm hover:bg-accent"
      >
        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Database className="size-3.5 text-muted-foreground" />
        <span className="truncate font-medium">{schema}</span>
      </button>
      {expanded && (
        <div className="ml-4 border-l pl-2">
          {tablesQuery.isPending && (
            <div className="py-1 text-xs text-muted-foreground">…</div>
          )}
          {tablesQuery.isError && (
            <div className="py-1 text-xs text-destructive">error</div>
          )}
          {tablesQuery.data?.map(t => (
            <TableNode
              key={t.name}
              target={target}
              schema={schema}
              table={t}
              onInsertTable={onInsertTable}
            />
          ))}
          {tablesQuery.data?.length === 0 && (
            <div className="py-1 text-xs text-muted-foreground">empty</div>
          )}
        </div>
      )}
    </div>
  )
}

function TableNode({
  target,
  schema,
  table,
  onInsertTable,
}: {
  target: string
  schema: string
  table: DbTableInfo
  onInsertTable: (schema: string, table: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const columnsQuery = useQuery({
    queryKey: ['sql', 'columns', target, schema, table.name],
    queryFn: async () => (await api.getDbColumns(target, schema, table.name)).columns,
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div>
      <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex items-center"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <button
          type="button"
          onClick={() => onInsertTable(schema, table.name)}
          className="flex flex-1 items-center gap-1.5 text-left text-xs"
          title={table.type}
        >
          <TableIcon className="size-3 text-muted-foreground" />
          <span className="truncate">{table.name}</span>
        </button>
      </div>
      {expanded && (
        <div className="ml-5 border-l pl-2">
          {columnsQuery.isPending && (
            <div className="py-1 text-xs text-muted-foreground">…</div>
          )}
          {columnsQuery.data?.map((c: DbColumnInfo) => (
            <div key={c.name} className="flex items-center gap-1.5 py-0.5 text-xs">
              <span className={cn('truncate', c.primary_key && 'font-semibold')}>{c.name}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{c.data_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
