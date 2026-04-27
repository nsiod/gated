import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table'
import type * as React from 'react'
import {

  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,

  useReactTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronsUpDown, ChevronUp, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface DataTableProps<TData> {
  columns: ColumnDef<TData>[]
  data: TData[]
  searchPlaceholder?: string
  searchColumn?: string
  pageSize?: number
  onRowClick?: (row: TData) => void
  emptyState?: React.ReactNode
  enableRowSelection?: boolean
  renderBulkActions?: (selected: TData[], clearSelection: () => void) => React.ReactNode
}

const ROW_INTERACTIVE_SELECTOR
  = 'a, button, input, select, textarea, label, [role="button"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="radio"], [role="tab"], [role="combobox"], [data-stop-row-click]'

export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  pageSize = 20,
  onRowClick,
  emptyState,
  enableRowSelection = false,
  renderBulkActions,
}: DataTableProps<TData>) {
  const { t } = useTranslation('common')
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  const effectiveColumns = useMemo<ColumnDef<TData>[]>(() => {
    if (!enableRowSelection)
      return columns
    const selectionColumn: ColumnDef<TData> = {
      id: '__select',
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={v => table.toggleAllPageRowsSelected(v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={v => row.toggleSelected(v)}
          aria-label="Select row"
          data-stop-row-click
        />
      ),
    }
    return [selectionColumn, ...columns]
  }, [columns, enableRowSelection])

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    state: { sorting, globalFilter, pagination, rowSelection },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows.map(r => r.original)
  const clearSelection = () => setRowSelection({})

  const rows = table.getRowModel().rows
  const showPagination = table.getPageCount() > 1

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder ?? t('table.search')}
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="pl-9"
        />
      </div>

      {enableRowSelection && renderBulkActions != null && selectedRows.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">
            {t('table.selectedCount', { count: selectedRows.length })}
          </span>
          <div className="flex items-center gap-2">
            {renderBulkActions(selectedRows, clearSelection)}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              {t('actions.cancel')}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder)
                    return <TableHead key={header.id} />

                  const sorted = header.column.getIsSorted()
                  // aria-sort must be one of ascending | descending | none
                  // and only applies when the column is sortable.
                  const ariaSort: React.AriaAttributes['aria-sort'] = header.column.getCanSort()
                    ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none')
                    : undefined
                  const sortHandler = header.column.getToggleSortingHandler()

                  return (
                    <TableHead key={header.id} aria-sort={ariaSort}>
                      {header.column.getCanSort()
                        ? (
                            <button
                              type="button"
                              onClick={sortHandler}
                              className="flex items-center gap-1 cursor-pointer select-none rounded outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <span className="text-muted-foreground" aria-hidden="true">
                                {sorted === 'asc'
                                  ? <ChevronUp className="h-4 w-4" />
                                  : sorted === 'desc'
                                    ? <ChevronDown className="h-4 w-4" />
                                    : <ChevronsUpDown className="h-4 w-4" />}
                              </span>
                              <span className="sr-only">
                                {sorted === 'asc'
                                  ? t('table.sortedAsc')
                                  : sorted === 'desc'
                                    ? t('table.sortedDesc')
                                    : t('table.sortUnsorted')}
                              </span>
                            </button>
                          )
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0
              ? (
                  rows.map(row => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className={cn(onRowClick != null && 'cursor-pointer hover:bg-muted/50 transition-colors focus-visible:bg-muted/50 focus-visible:outline-none')}
                      role={onRowClick != null ? 'button' : undefined}
                      tabIndex={onRowClick != null ? 0 : undefined}
                      onClick={onRowClick != null
                        ? (e) => {
                            const target = e.target as HTMLElement
                            const interactive = target.closest(ROW_INTERACTIVE_SELECTOR)
                            if (interactive != null && interactive !== e.currentTarget)
                              return
                            onRowClick(row.original)
                          }
                        : undefined}
                      onKeyDown={onRowClick != null
                        ? (e) => {
                            if (e.key !== 'Enter' && e.key !== ' ')
                              return
                            const target = e.target as HTMLElement
                            const interactive = target.closest(ROW_INTERACTIVE_SELECTOR)
                            if (interactive != null && interactive !== e.currentTarget)
                              return
                            e.preventDefault()
                            onRowClick(row.original)
                          }
                        : undefined}
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )
              : emptyState != null
                ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-0">
                        {emptyState}
                      </TableCell>
                    </TableRow>
                  )
                : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        {t('table.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
          </TableBody>
        </Table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('table.rowsPerPage')}</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={val => table.setPageSize(Number(val))}
            >
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map(size => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {t('table.pagination', {
                page: table.getState().pagination.pageIndex + 1,
                total: table.getPageCount(),
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="cursor-pointer"
            >
              {t('table.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="cursor-pointer"
            >
              {t('table.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
