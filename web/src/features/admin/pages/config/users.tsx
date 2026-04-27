import type { ColumnDef } from '@tanstack/react-table'
import type { Role, User } from '@/features/admin/lib/api'
import { useQueries } from '@tanstack/react-query'
import { MoreHorizontal, Plus, UserCircle, Users as UsersIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { adminKeys, useDeleteUser, useRoles, useUsers } from '@/features/admin/api'
import { api } from '@/features/admin/lib/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { DataTable } from '@/shared/components/data-table'
import { EmptyCell } from '@/shared/components/empty-cell'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { TableSkeleton } from '@/shared/components/table-skeleton'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { isBlank } from '@/shared/lib/utils'

export function Component() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const { data: users, isLoading } = useUsers()
  const { data: allRoles } = useRoles()
  const deleteUser = useDeleteUser()
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  const roleUserQueries = useQueries({
    queries: (allRoles ?? []).map(role => ({
      queryKey: adminKeys.roleUsers(role.id),
      queryFn: async () => api.getRoleUsers(role.id),
    })),
  })

  const userRolesMap = useMemo(() => {
    const map = new Map<string, Role[]>()
    ;(allRoles ?? []).forEach((role, idx) => {
      const roleUsers = roleUserQueries[idx]?.data
      if (roleUsers == null)
        return
      for (const u of roleUsers) {
        const list = map.get(u.id) ?? []
        list.push(role)
        map.set(u.id, list)
      }
    })
    return map
  }, [allRoles, roleUserQueries])

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'username',
      header: t('users.columns.username'),
      cell: ({ row }) => (
        <Link
          to={`/ui/admin/config/users/${row.original.id}`}
          className="font-medium hover:underline flex items-center gap-2"
        >
          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          {row.original.username}
        </Link>
      ),
    },
    {
      accessorKey: 'description',
      header: t('users.columns.description'),
      cell: ({ row }) => isBlank(row.original.description)
        ? <EmptyCell />
        : <span className="text-muted-foreground">{row.original.description}</span>,
    },
    {
      id: 'roles',
      header: t('users.columns.roles'),
      cell: ({ row }) => {
        const roles = userRolesMap.get(row.original.id) ?? []
        if (roles.length === 0)
          return <EmptyCell />
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map(role => (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        )
      },
    },
    {
      id: 'ldap',
      header: t('users.columns.ldap'),
      cell: ({ row }) => isBlank(row.original.ldap_server_id)
        ? <EmptyCell />
        : <span className="text-muted-foreground text-sm">{t('users.ldap.linked')}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer" />}>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="cursor-pointer" onClick={() => void navigate(`/ui/admin/config/users/${row.original.id}`)}>
                {t('sessions.actions.viewDetail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={() => setDeleteTarget(row.original)}
              >
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  async function handleDelete() {
    if (deleteTarget == null)
      return
    try {
      await deleteUser.mutateAsync(deleteTarget.id)
      toast.success(t('users.deleted'))
    }
    catch {
      toast.error(t('users.deleteError'))
    }
    finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div>
      <PageHeader
        title={t('users.title')}
        description={t('users.description')}
        actions={(
          <Button render={<Link to="/ui/admin/config/users/new" />} className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            {t('users.create')}
          </Button>
        )}
      />

      {isLoading
        ? (
            <TableSkeleton columns={5} rows={5} />
          )
        : (
            <DataTable
              columns={columns}
              data={users ?? []}
              searchPlaceholder={t('users.searchPlaceholder')}
              onRowClick={row => void navigate(`/ui/admin/config/users/${row.id}`)}
              emptyState={(
                <EmptyState
                  icon={UsersIcon}
                  title={t('users.empty')}
                  description={t('users.emptyDescription')}
                  action={(
                    <Button render={<Link to="/ui/admin/config/users/new" />} className="cursor-pointer">
                      <Plus className="h-4 w-4 mr-2" />
                      {t('users.create')}
                    </Button>
                  )}
                />
              )}
            />
          )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('users.deleteTitle')}
        description={t('users.deleteDescription')}
        confirmLabel={t('common.delete')}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
