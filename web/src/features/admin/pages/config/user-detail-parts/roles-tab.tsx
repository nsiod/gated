import { Award, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useAddUserRole,
  useDeleteUserRole,
  useRoles,
  useUserRoles,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Skeleton } from '@/shared/components/ui/skeleton'

export function RolesTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: userRoles, isLoading: rolesLoading } = useUserRoles(userId)
  const { data: allRoles, isLoading: allLoading } = useRoles()
  const addRole = useAddUserRole(userId)
  const removeRole = useDeleteUserRole(userId)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<{ id: string, name: string } | null>(null)

  const assignedIds = new Set(userRoles?.map(r => r.id) ?? [])
  const availableRoles = allRoles?.filter(r => !assignedIds.has(r.id)) ?? []

  async function handleAdd(roleId: string) {
    try {
      await addRole.mutateAsync(roleId)
      toast.success(t('users.credentials.role.addSuccess'))
    }
    catch {
      toast.error(t('users.credentials.role.addError'))
    }
  }

  async function handleRemove() {
    if (!removeTarget)
      return
    try {
      await removeRole.mutateAsync(removeTarget.id)
      toast.success(t('users.credentials.role.removeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.role.removeError'))
    }
    finally {
      setRemoveTarget(null)
    }
  }

  if (rolesLoading)
    return <Skeleton className="h-24 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddDialogOpen(true)} disabled={availableRoles.length === 0 || allLoading}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.role.add')}
        </Button>
      </div>

      {!userRoles || userRoles.length === 0
        ? (
            <EmptyState icon={Award} title={t('users.credentials.role.empty')} description={t('users.credentials.role.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {userRoles.map(role => (
                <div key={role.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div>
                    <p className="text-sm font-medium">{role.name}</p>
                    {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={tc('actions.delete')}
                    onClick={() => setRemoveTarget({ id: role.id, name: role.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.role.addTitle')}</DialogTitle>
            <DialogDescription>{t('users.credentials.role.addDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availableRoles.length === 0
              ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t('users.credentials.role.noMore')}</p>
                )
              : (
                  availableRoles.map(role => (
                    <div key={role.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{role.name}</p>
                        {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={addRole.isPending}
                        onClick={() => {
                          void handleAdd(role.id).then(() => {
                            setAddDialogOpen(false)
                          })
                        }}
                      >
                        {tc('actions.add')}
                      </Button>
                    </div>
                  ))
                )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>{tc('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={open => !open && setRemoveTarget(null)}
        title={t('users.credentials.role.removeTitle')}
        description={t('users.credentials.role.removeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleRemove()}
      />
    </div>
  )
}
