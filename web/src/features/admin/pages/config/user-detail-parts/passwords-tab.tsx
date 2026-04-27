import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useCreatePasswordCredential,
  useDeletePasswordCredential,
  usePasswordCredentials,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required'),
})
type PasswordFormValues = z.infer<typeof passwordSchema>

export function PasswordsTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: credentials, isLoading } = usePasswordCredentials(userId)
  const createCred = useCreatePasswordCredential(userId)
  const deleteCred = useDeletePasswordCredential(userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  })

  async function onSubmit(values: PasswordFormValues) {
    try {
      await createCred.mutateAsync({ password: values.password })
      toast.success(t('users.credentials.password.setSuccess'))
      form.reset()
      setDialogOpen(false)
    }
    catch {
      toast.error(t('users.credentials.password.setError'))
    }
  }

  async function handleDelete() {
    if (deleteId == null)
      return
    try {
      await deleteCred.mutateAsync(deleteId)
      toast.success(t('users.credentials.password.removeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.password.removeError'))
    }
    finally {
      setDeleteId(null)
    }
  }

  if (isLoading)
    return <Skeleton className="h-24 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.password.set')}
        </Button>
      </div>

      {!credentials || credentials.length === 0
        ? (
            <EmptyState icon={KeyRound} title={t('users.credentials.password.empty')} description={t('users.credentials.password.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {credentials.map(cred => (
                <div key={cred.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">{cred.id}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={tc('actions.delete')}
                    onClick={() => setDeleteId(cred.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('users.credentials.password.set')}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.password.label')}</FormLabel>
                    <FormControl><Input type="password" placeholder={t('users.credentials.password.placeholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('actions.cancel')}</Button>
                <Button type="submit" disabled={createCred.isPending}>{createCred.isPending ? tc('actions.loading') : tc('actions.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={open => !open && setDeleteId(null)}
        title={t('users.credentials.password.removeTitle')}
        description={t('users.credentials.password.removeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
