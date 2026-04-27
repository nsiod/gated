import type { ColumnDef } from '@tanstack/react-table'
import type { Target, TargetOptions } from '@/features/admin/lib/api'
import { Pencil, Plus, Server, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useDeleteTarget, useRoles, useTargetGroupsQuery, useTargets } from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { DataTable } from '@/shared/components/data-table'
import { EmptyCell } from '@/shared/components/empty-cell'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { TableSkeleton } from '@/shared/components/table-skeleton'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { targetTypeClass } from '@/shared/lib/target-types'
import { cn } from '@/shared/lib/utils'

function getAddress(options: TargetOptions): string | null {
  switch (options.kind) {
    case 'Ssh':
      return `${options.host}:${options.port}`
    case 'MySql':
      return `${options.host}:${options.port}`
    case 'Postgres':
      return `${options.host}:${options.port}`
    case 'Kubernetes':
      return options.cluster_url
    case 'Api':
      return options.url
    case 'WebAdmin':
      return null
  }
}

export function Component() {
  const { t } = useTranslation(['admin', 'common'])
  const navigate = useNavigate()
  const [groupId, setGroupId] = useState<string>('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [bulkDeleteRows, setBulkDeleteRows] = useState<Target[] | null>(null)
  const [bulkClearFn, setBulkClearFn] = useState<(() => void) | null>(null)

  const { data: targets, isLoading } = useTargets({ group_id: groupId || undefined })
  const { data: groups } = useTargetGroupsQuery()
  const { data: roles } = useRoles()
  const deleteMutation = useDeleteTarget()

  const groupMap = new Map(groups?.map(g => [g.id, g.name]) ?? [])
  const roleMap = new Map(roles?.map(r => [r.id, r.name]) ?? [])

  const columns: ColumnDef<Target>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: t('targets.columns.name'),
      cell: ({ row }) => (
        <Link
          to={`/ui/admin/config/targets/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: 'type',
      accessorFn: row => t(`common:targetTypes.${row.options.kind}`, row.options.kind),
      header: t('targets.columns.type'),
      cell: ({ row }) => {
        const kind = row.original.options.kind
        return (
          <Badge
            variant="outline"
            className={cn('font-medium', targetTypeClass(kind))}
          >
            {t(`common:targetTypes.${kind}`, kind)}
          </Badge>
        )
      },
    },
    {
      id: 'address',
      accessorFn: row => getAddress(row.options) ?? '',
      header: t('targets.columns.address'),
      cell: ({ row }) => {
        const address = getAddress(row.original.options)
        return address != null
          ? <span className="font-mono text-sm text-muted-foreground">{address}</span>
          : <EmptyCell />
      },
    },
    {
      id: 'group',
      accessorFn: row => row.group_id != null && row.group_id !== '' ? (groupMap.get(row.group_id) ?? row.group_id) : '',
      header: t('targets.columns.group'),
      cell: ({ row }) => {
        const name = row.original.group_id != null && row.original.group_id !== '' ? groupMap.get(row.original.group_id) : undefined
        return name != null ? <span className="text-muted-foreground">{name}</span> : <EmptyCell />
      },
    },
    {
      id: 'roles',
      accessorFn: row => row.allow_roles.map(id => roleMap.get(id) ?? id).join(', '),
      header: t('targets.columns.roles'),
      cell: ({ row }) => {
        const ids = row.original.allow_roles
        if (ids.length === 0)
          return <EmptyCell />
        return (
          <div className="flex flex-wrap gap-1">
            {ids.map(id => (
              <Badge key={id} variant="secondary" className="text-xs font-normal">
                {roleMap.get(id) ?? id}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common:actions.edit')}
            render={<Link to={`/ui/admin/config/targets/${row.original.id}`} />}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label={t('common:actions.delete')}
            onClick={() => setDeleteId(row.original.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('targets.title')}
        description={t('targets.description')}
        actions={(
          <Button render={<Link to="/ui/admin/config/targets/new" />}>
            <Plus className="mr-2 h-4 w-4" />
            {t('targets.create')}
          </Button>
        )}
      />

      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="targets-group-filter" className="text-sm text-muted-foreground">
          {t('targets.groupFilter')}
          :
        </label>
        <Select value={groupId || 'all'} onValueChange={val => setGroupId((val ?? 'all') === 'all' ? '' : (val ?? 'all'))}>
          <SelectTrigger id="targets-group-filter" className="w-48">
            <SelectValue>
              {(value: string | null) => value == null || value === 'all'
                ? t('targets.allGroups')
                : (groupMap.get(value) ?? value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('targets.allGroups')}</SelectItem>
            {groups?.map(g => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading
        ? (
            <TableSkeleton columns={6} rows={5} />
          )
        : (
            <DataTable
              columns={columns}
              data={targets ?? []}
              searchPlaceholder={t('targets.searchPlaceholder')}
              onRowClick={row => void navigate(`/ui/admin/config/targets/${row.id}`)}
              enableRowSelection
              renderBulkActions={(selected, clear) => (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setBulkDeleteRows(selected)
                    setBulkClearFn(() => clear)
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t('common:actions.delete')}
                </Button>
              )}
              emptyState={(
                <EmptyState
                  icon={Server}
                  title={t('targets.empty')}
                  description={t('targets.emptyDescription')}
                  action={(
                    <Button render={<Link to="/ui/admin/config/targets/new" />}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('targets.create')}
                    </Button>
                  )}
                />
              )}
            />
          )}

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open)
            setDeleteId(null)
        }}
        title={t('targets.deleteTitle')}
        description={t('targets.deleteDescription')}
        confirmLabel={t('common:actions.delete')}
        onConfirm={() => {
          if (deleteId != null) {
            deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteRows != null}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDeleteRows(null)
            setBulkClearFn(null)
          }
        }}
        title={t('targets.bulkDeleteTitle', { count: bulkDeleteRows?.length ?? 0 })}
        description={t('targets.bulkDeleteDescription')}
        confirmLabel={t('common:actions.delete')}
        onConfirm={() => {
          const rows = bulkDeleteRows ?? []
          const clear = bulkClearFn
          let succeeded = 0
          let failed = 0
          void Promise.allSettled(
            rows.map(async r => deleteMutation.mutateAsync(r.id)),
          ).then((results) => {
            for (const r of results) {
              if (r.status === 'fulfilled')
                succeeded += 1
              else
                failed += 1
            }
            if (failed === 0)
              toast.success(t('targets.bulkDeleteSuccess', { count: succeeded }))
            else
              toast.error(t('targets.bulkDeletePartial', { succeeded, failed }))
            setBulkDeleteRows(null)
            setBulkClearFn(null)
            clear?.()
          })
        }}
      />
    </div>
  )
}
