import { Plus, Smartphone, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  useCreateOtpCredentialMutation,
  useDeleteOtpCredentialMutation,
  useOtpCredentialsQuery,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { CopyButton } from '@/shared/components/copy-button'
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
import { buildOtpUri } from './otp-uri'

interface OtpSetupState {
  secret: Uint8Array
  uri: string
}

export function OtpTab({ userId, username }: { userId: string, username: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: credentials, isLoading } = useOtpCredentialsQuery(userId)
  const createCred = useCreateOtpCredentialMutation(userId)
  const deleteCred = useDeleteOtpCredentialMutation(userId)
  const [setup, setSetup] = useState<OtpSetupState | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const generateAndShow = useCallback(() => {
    const secret = crypto.getRandomValues(new Uint8Array(20))
    setSetup({ secret, uri: buildOtpUri(username, secret) })
  }, [username])

  async function confirmAdd() {
    if (!setup)
      return
    try {
      await createCred.mutateAsync({ secret_key: Array.from(setup.secret) })
      toast.success(t('users.credentials.otpCred.addSuccess'))
      setSetup(null)
    }
    catch {
      toast.error(t('users.credentials.otpCred.addError'))
    }
  }

  async function handleDelete() {
    if (deleteId == null)
      return
    try {
      await deleteCred.mutateAsync(deleteId)
      toast.success(t('users.credentials.otpCred.removeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.otpCred.removeError'))
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
        <Button size="sm" onClick={generateAndShow}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.otpCred.add')}
        </Button>
      </div>

      {!credentials || credentials.length === 0
        ? (
            <EmptyState icon={Smartphone} title={t('users.credentials.otpCred.empty')} description={t('users.credentials.otpCred.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {credentials.map(cred => (
                <div key={cred.id} className="flex items-center justify-between p-3 rounded-md border">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
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

      <Dialog open={!!setup} onOpenChange={open => !open && setSetup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.otpCred.setupTitle')}</DialogTitle>
            <DialogDescription>
              {t('users.credentials.otpCred.setupDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{t('users.credentials.otpCred.provisioningUri')}</p>
              <div className="flex items-start gap-2">
                <p className="text-xs font-mono break-all flex-1">{setup?.uri}</p>
                {setup && <CopyButton value={setup.uri} label={t('users.credentials.otpCred.copyUri')} />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('users.credentials.otpCred.afterConfirm')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetup(null)}>{tc('actions.cancel')}</Button>
            <Button onClick={() => void confirmAdd()} disabled={createCred.isPending}>
              {createCred.isPending ? tc('actions.loading') : t('users.credentials.otpCred.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        onOpenChange={open => !open && setDeleteId(null)}
        title={t('users.credentials.otpCred.removeTitle')}
        description={t('users.credentials.otpCred.removeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
