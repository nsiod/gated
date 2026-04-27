import type { ExistingCertificateCredential, IssuedCertificateCredential } from '@/features/admin/lib/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileBadge, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useCertCredentialsQuery,
  useIssueCertCredentialMutation,
  useRevokeCertCredentialMutation,
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

const certIssueSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  public_key_pem: z.string().min(1, 'Public key PEM is required'),
})
type CertIssueFormValues = z.infer<typeof certIssueSchema>

export function CertificatesTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: credentials, isLoading } = useCertCredentialsQuery(userId)
  const issueCert = useIssueCertCredentialMutation(userId)
  const revokeCert = useRevokeCertCredentialMutation(userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [issuedResult, setIssuedResult] = useState<IssuedCertificateCredential | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ExistingCertificateCredential | null>(null)

  const form = useForm<CertIssueFormValues>({
    resolver: zodResolver(certIssueSchema),
    defaultValues: { label: '', public_key_pem: '' },
  })

  async function onIssue(values: CertIssueFormValues) {
    try {
      const result = await issueCert.mutateAsync(values)
      setIssuedResult(result)
      form.reset()
      setDialogOpen(false)
    }
    catch {
      toast.error(t('users.credentials.certificate.issueError'))
    }
  }

  async function handleRevoke() {
    if (!revokeTarget)
      return
    try {
      await revokeCert.mutateAsync(revokeTarget.id)
      toast.success(t('users.credentials.certificate.revokeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.certificate.revokeError'))
    }
    finally {
      setRevokeTarget(null)
    }
  }

  if (isLoading)
    return <Skeleton className="h-24 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.certificate.issue')}
        </Button>
      </div>

      {!credentials || credentials.length === 0
        ? (
            <EmptyState icon={FileBadge} title={t('users.credentials.certificate.empty')} description={t('users.credentials.certificate.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {credentials.map(cred => (
                <div key={cred.id} className="p-3 rounded-md border space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileBadge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{cred.label}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      aria-label={tc('actions.delete')}
                      onClick={() => setRevokeTarget(cred)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6 font-mono">
                    {t('users.credentials.certificate.fingerprint')}
                    {cred.fingerprint}
                  </p>
                  {cred.date_added != null && cred.date_added !== '' && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('users.credentials.certificate.dateAdded')}
                      {new Date(cred.date_added).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.certificate.issueTitle')}</DialogTitle>
            <DialogDescription>{t('users.credentials.certificate.issueDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onIssue)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.certificate.label')}</FormLabel>
                    <FormControl><Input placeholder="e.g. Work laptop cert" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="public_key_pem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.certificate.publicKeyPem')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder="-----BEGIN PUBLIC KEY-----&#10;..." rows={5} className="font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('actions.cancel')}</Button>
                <Button type="submit" disabled={issueCert.isPending}>{issueCert.isPending ? t('users.credentials.certificate.issuing') : t('users.credentials.certificate.issueButton')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issuedResult} onOpenChange={open => !open && setIssuedResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.certificate.issuedTitle')}</DialogTitle>
            <DialogDescription>{t('users.credentials.certificate.issuedDescription')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t('users.credentials.certificate.certificatePem')}</p>
              {issuedResult && <CopyButton value={issuedResult.certificate_pem} label={t('users.credentials.certificate.copyCert')} />}
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {issuedResult?.certificate_pem}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssuedResult(null)}>{tc('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={open => !open && setRevokeTarget(null)}
        title={t('users.credentials.certificate.revokeTitle')}
        description={t('users.credentials.certificate.revokeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleRevoke()}
      />
    </div>
  )
}
