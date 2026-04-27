import type { ApiTokenAndSecret } from '@/features/admin/lib/api'
import { zodResolver } from '@hookform/resolvers/zod'
import { KeyIcon, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  useCreateUserApiToken,
  useDeleteUserApiToken,
  useUserApiTokens,
} from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { CopyButton } from '@/shared/components/copy-button'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
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

const apiTokenSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  expiryDays: z.number().int().min(1).max(365),
})
type ApiTokenFormValues = z.infer<typeof apiTokenSchema>

export function ApiTokensTab({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: tokens, isLoading } = useUserApiTokens(userId)
  const createToken = useCreateUserApiToken(userId)
  const deleteToken = useDeleteUserApiToken(userId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [issuedResult, setIssuedResult] = useState<ApiTokenAndSecret | null>(null)
  const [revokeId, setRevokeId] = useState<string | null>(null)

  const form = useForm<ApiTokenFormValues>({
    resolver: zodResolver(apiTokenSchema),
    defaultValues: { label: '', expiryDays: 30 },
  })

  async function onIssue(values: ApiTokenFormValues) {
    const expiry = new Date()
    expiry.setDate(expiry.getDate() + values.expiryDays)
    try {
      const result = await createToken.mutateAsync({ label: values.label, expiry: expiry.toISOString() })
      setIssuedResult(result)
      form.reset({ label: '', expiryDays: 30 })
      setDialogOpen(false)
    }
    catch {
      toast.error(t('users.credentials.apiToken.addError'))
    }
  }

  async function handleRevoke() {
    if (revokeId == null)
      return
    try {
      await deleteToken.mutateAsync(revokeId)
      toast.success(t('users.credentials.apiToken.revokeSuccess'))
    }
    catch {
      toast.error(t('users.credentials.apiToken.revokeError'))
    }
    finally {
      setRevokeId(null)
    }
  }

  if (isLoading)
    return <Skeleton className="h-24 w-full" />

  const now = Date.now()

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('users.credentials.apiToken.create')}
        </Button>
      </div>

      {!tokens || tokens.length === 0
        ? (
            <EmptyState icon={KeyIcon} title={t('users.credentials.apiToken.empty')} description={t('users.credentials.apiToken.emptyDescription')} />
          )
        : (
            <div className="space-y-2">
              {tokens.map((token) => {
                const expired = new Date(token.expiry).getTime() <= now
                return (
                  <div key={token.id} className="p-3 rounded-md border space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <KeyIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{token.label}</span>
                        {expired && (
                          <Badge variant="destructive" className="text-xs">
                            {t('users.credentials.apiToken.expired')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={tc('actions.delete')}
                        onClick={() => setRevokeId(token.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('users.credentials.apiToken.created')}
                      {' '}
                      {new Date(token.created).toLocaleString()}
                      {' · '}
                      {t('users.credentials.apiToken.expires')}
                      {' '}
                      {new Date(token.expiry).toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.apiToken.createTitle')}</DialogTitle>
            <DialogDescription>{t('users.credentials.apiToken.createDescription')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onIssue)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.apiToken.label')}</FormLabel>
                    <FormControl><Input placeholder={t('users.credentials.apiToken.labelPlaceholder')} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.credentials.apiToken.expiryDays')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        {...field}
                        onChange={e => field.onChange(e.target.valueAsNumber)}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">{t('users.credentials.apiToken.expiryDaysDescription')}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{tc('actions.cancel')}</Button>
                <Button type="submit" disabled={createToken.isPending}>
                  {createToken.isPending ? t('users.credentials.apiToken.issuing') : t('users.credentials.apiToken.issueButton')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issuedResult} onOpenChange={open => !open && setIssuedResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.credentials.apiToken.issuedTitle')}</DialogTitle>
            <DialogDescription>{t('users.credentials.apiToken.issuedDescription')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">{t('users.credentials.apiToken.secret')}</p>
              {issuedResult && <CopyButton value={issuedResult.secret} label={t('users.credentials.apiToken.copySecret')} />}
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap break-all">
              {issuedResult?.secret}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIssuedResult(null)}>{tc('actions.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revokeId != null}
        onOpenChange={open => !open && setRevokeId(null)}
        title={t('users.credentials.apiToken.revokeTitle')}
        description={t('users.credentials.apiToken.revokeDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleRevoke()}
      />
    </div>
  )
}
