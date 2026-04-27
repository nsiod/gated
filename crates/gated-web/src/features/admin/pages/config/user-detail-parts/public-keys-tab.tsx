import type { ExistingPublicKeyCredential } from '@/features/admin/lib/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useCreatePublicKeyCredential,
  useDeletePublicKeyCredential,
  usePublicKeyCredentials,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { CopyButton } from '@/shared/components/copy-button'
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
import { Textarea } from '@/shared/components/ui/textarea'

const publicKeySchema = z.object({
  label: z.string().min(1, 'Label is required'),
  openssh_public_key: z.string().min(1, 'Public key is required'),
})
type PublicKeyFormValues = z.infer<typeof publicKeySchema>

export function PublicKeysTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: credentials, isLoading } = usePublicKeyCredentials(userId)
  const createCred = useCreatePublicKeyCredential(userId)
  const deleteCred = useDeletePublicKeyCredential(userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ExistingPublicKeyCredential | null>(null)

  const form = useForm<PublicKeyFormValues>({
    resolver: zodResolver(publicKeySchema),
    defaultValues: { label: '', openssh_public_key: '' },
  })

  async function onSubmit(values: PublicKeyFormValues) {
    try {
      await createCred.mutateAsync(values)
      toast.success(t('users.credentials.publicKey.addSuccess'))
      form.reset()
      setDialogOpen(false)
    }
    catch {
      toast.error(t('users.credentials.publicKey.addError'))
    }
  }

  async function handleDelete() {
    if (!deleteTarget)
      return
    try {
      await deleteCred.mutateAsync(deleteTarget.id)
      toast.success(t('users.credentials.publicKey.removeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.publicKey.removeError'))
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
          {t('users.credentials.publicKey.add')}
        </Button>
      </div>

      {!credentials || credentials.length === 0
        ? (
            <EmptyState icon={ShieldCheck} title={t('users.credentials.publicKey.empty')} description={t('users.credentials.publicKey.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {credentials.map(cred => (
                <div key={cred.id} className="p-3 rounded-md border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cred.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CopyButton value={cred.openssh_public_key} label={t('users.credentials.publicKey.copyKey')} />
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
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate pl-6">{cred.openssh_public_key}</p>
                  {cred.last_used != null && cred.last_used !== '' && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('users.credentials.publicKey.lastUsed')}
                      {new Date(cred.last_used).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('users.credentials.publicKey.addTitle')}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.publicKey.label')}</FormLabel>
                    <FormControl><Input placeholder="e.g. My laptop" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openssh_public_key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.publicKey.opensshKey')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder="ssh-ed25519 AAAA..." rows={4} className="font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('actions.cancel')}</Button>
                <Button type="submit" disabled={createCred.isPending}>{createCred.isPending ? tc('actions.loading') : tc('actions.add')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={open => !open && setDeleteTarget(null)}
        title={t('users.credentials.publicKey.removeTitle')}
        description={t('users.credentials.publicKey.removeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
