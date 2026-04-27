import type { DbQueryResponse } from '@/features/gateway/lib/api-client'
import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

function formatCell(v: string | number | boolean | null): string {
  if (v == null)
    return 'NULL'
  if (typeof v === 'boolean')
    return v ? 'true' : 'false'
  return String(v)
}

export function ResultGrid({ data }: { data: DbQueryResponse }) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedRows = useMemo(() => {
    if (sortCol == null)
      return data.rows
    const copy = [...data.rows]
    copy.sort((a, b) => {
      const av = a[sortCol]
      const bv = b[sortCol]
      if (av == null && bv == null)
        return 0
      if (av == null)
        return -1
      if (bv == null)
        return 1
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av
      const as = String(av)
      const bs = String(bv)
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
    return copy
  }, [data.rows, sortCol, sortDir])

  const toggleSort = (idx: number) => {
    if (sortCol === idx) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    }
    else {
      setSortCol(idx)
      setSortDir('asc')
    }
  }

  if (data.columns.length === 0) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        {data.rows_affected != null
          ? `${data.rows_affected} row(s) affected`
          : 'Statement executed — no rows.'}
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {data.columns.map((c, i) => (
              <TableHead
                key={`${c.name}-${String(i)}`}
                className="cursor-pointer select-none whitespace-nowrap hover:bg-accent"
                onClick={() => toggleSort(i)}
              >
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.type_name}</span>
                  {sortCol === i && (
                    <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, ri) => (
            <TableRow key={`row-${String(ri)}`}>
              {row.map((cell, ci) => (
                <TableCell
                  key={`cell-${String(ri)}-${String(ci)}`}
                  className={cn(
                    'whitespace-nowrap font-mono text-xs',
                    cell == null && 'italic text-muted-foreground',
                  )}
                >
                  {formatCell(cell)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
