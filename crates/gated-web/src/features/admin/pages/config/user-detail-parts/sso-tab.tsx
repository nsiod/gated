import type { ExistingSsoCredential } from '@/features/admin/lib/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useCreateSsoCredential,
  useDeleteSsoCredential,
  useSsoCredentials,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
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

const ssoSchema = z.object({
  email: z.string().email('Must be a valid email'),
  provider: z.string().optional(),
})
type SsoFormValues = z.infer<typeof ssoSchema>

export function SsoTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: credentials, isLoading } = useSsoCredentials(userId)
  const createCred = useCreateSsoCredential(userId)
  const deleteCred = useDeleteSsoCredential(userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExistingSsoCredential | null>(null)

  const form = useForm<SsoFormValues>({
    resolver: zodResolver(ssoSchema),
    defaultValues: { email: '', provider: '' },
  })

  async function onSubmit(values: SsoFormValues) {
    try {
      await createCred.mutateAsync({ email: values.email, provider: values.provider != null && values.provider !== '' ? values.provider : undefined })
      toast.success(t('users.credentials.ssoCred.addSuccess'))
      form.reset()
      setDialogOpen(false)
    }
    catch {
      toast.error(t('users.credentials.ssoCred.addError'))
    }
  }

  async function handleDelete() {
    if (!deleteTarget)
      return
    try {
      await deleteCred.mutateAsync(deleteTarget.id)
      toast.success(t('users.credentials.ssoCred.removeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.ssoCred.removeError'))
    }
    finally {
      setDeleteTarget(null)
    }
  }

  if (isLoading)
    return <Skeleton className="h-24 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.ssoCred.add')}
        </Button>
      </div>

      {!credentials || credentials.length === 0
        ? (
            <EmptyState icon={Mail} title={t('users.credentials.ssoCred.empty')} description={t('users.credentials.ssoCred.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {credentials.map(cred => (
                <div key={cred.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{cred.email}</span>
                    {cred.provider != null && cred.provider !== '' && <Badge variant="secondary" className="text-xs">{cred.provider}</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    aria-label={tc('actions.delete')}
                    onClick={() => setDeleteTarget(cred)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('users.credentials.ssoCred.addTitle')}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.ssoCred.email')}</FormLabel>
                    <FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.ssoCred.provider')}</FormLabel>
                    <FormControl><Input placeholder="e.g. google, github" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('actions.cancel')}</Button>
                <Button type="submit" disabled={createCred.isPending}>{createCred.isPending ? t('users.credentials.ssoCred.adding') : tc('actions.add')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('users.credentials.ssoCred.removeTitle')}
        description={t('users.credentials.ssoCred.removeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
