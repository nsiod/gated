import type { ExistingProfileTicket, ProfileTicketAndSecret } from '@/features/gateway/lib/api-client'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useCreateMyTicketMutation, useDeleteMyTicketMutation, useMyTicketsQuery, useTargetsQuery } from '@/features/gateway/api'
import { CopyButton } from '@/shared/components/copy-button'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'

const createTicketSchema = z.object({
  target_name: z.string().min(1),
  expiryDays: z.number().int().min(0).max(365),
  number_of_uses: z.number().int().min(0).max(10000),
  description: z.string().optional(),
})
type CreateTicketForm = z.infer<typeof createTicketSchema>

function TicketRow({ ticket, onDelete }: { ticket: ExistingProfileTicket, onDelete: (id: string) => void }) {
  const { t } = useTranslation('gateway')
  return (
    <div className="flex items-center gap-2 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{ticket.target}</p>
        <p className="text-xs text-muted-foreground">
          {t('tickets.created', { date: new Date(ticket.created).toLocaleString() })}
          {' · '}
          {ticket.expiry != null
            ? t('tickets.expires', { date: new Date(ticket.expiry).toLocaleString() })
            : t('tickets.noExpiry')}
          {' · '}
          {ticket.uses_left != null
            ? t('tickets.usesLeft', { count: ticket.uses_left })
            : t('tickets.unlimitedUses')}
        </p>
        {ticket.description !== '' && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ticket.description}</p>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => onDelete(ticket.id)}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  )
}

function CreateTicketDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation(['gateway', 'common'])
  const createTicket = useCreateMyTicketMutation()
  const targetsQuery = useTargetsQuery()
  const [issued, setIssued] = useState<ProfileTicketAndSecret | null>(null)

  const form = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { target_name: '', expiryDays: 7, number_of_uses: 1, description: '' },
  })

  async function onSubmit(values: CreateTicketForm) {
    const expiry = values.expiryDays > 0
      ? (() => {
          const d = new Date()
          d.setDate(d.getDate() + values.expiryDays)
          return d.toISOString()
        })()
      : undefined
    try {
      const result = await createTicket.mutateAsync({
        target_name: values.target_name,
        expiry,
        number_of_uses: values.number_of_uses > 0 ? values.number_of_uses : undefined,
        description: values.description !== undefined && values.description !== '' ? values.description : undefined,
      })
      setIssued(result)
    }
    catch {
      toast.error(t('gateway:tickets.createError'))
    }
  }

  function handleClose() {
    setIssued(null)
    form.reset({ target_name: '', expiryDays: 7, number_of_uses: 1, description: '' })
    onOpenChange(false)
  }

  const targets = targetsQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('gateway:tickets.createTitle')}</DialogTitle>
          <DialogDescription>{t('gateway:tickets.createDescription')}</DialogDescription>
        </DialogHeader>

        {issued != null
          ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-warning-foreground">{t('gateway:tickets.secretWarning')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">{issued.secret}</code>
                  <CopyButton value={issued.secret} label={t('common:actions.copy')} />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">{t('gateway:tickets.target')}</span>
                    {' '}
                    {issued.ticket.target}
                  </p>
                  {issued.ticket.expiry != null && (
                    <p>
                      <span className="font-medium">{t('gateway:tickets.expires', { date: '' })}</span>
                      {' '}
                      {new Date(issued.ticket.expiry).toLocaleString()}
                    </p>
                  )}
                  {issued.ticket.uses_left != null && (
                    <p>
                      <span className="font-medium">{t('gateway:tickets.usesLeftLabel')}</span>
                      {' '}
                      {issued.ticket.uses_left}
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <Button onClick={handleClose}>{t('common:actions.close')}</Button>
                </DialogFooter>
              </div>
            )
          : (
              <Form {...form}>
                <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="target_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gateway:tickets.target')}</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('gateway:tickets.selectTarget')} />
                            </SelectTrigger>
                            <SelectContent>
                              {targets.map(tgt => (
                                <SelectItem key={tgt.name} value={tgt.name}>
                                  {tgt.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiryDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gateway:tickets.expiryDays')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={365} {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{t('gateway:tickets.expiryDaysHint')}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="number_of_uses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gateway:tickets.numberOfUses')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={10000} {...field} onChange={e => field.onChange(e.target.valueAsNumber)} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">{t('gateway:tickets.numberOfUsesHint')}</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('gateway:tickets.description')}</FormLabel>
                        <FormControl>
                          <Textarea rows={2} placeholder={t('gateway:tickets.descriptionPlaceholder')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={handleClose}>
                      {t('common:actions.cancel')}
                    </Button>
                    <Button type="submit" disabled={createTicket.isPending}>
                      {createTicket.isPending ? t('common:actions.loading') : t('gateway:tickets.create')}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
      </DialogContent>
    </Dialog>
  )
}

export function Component() {
  const { t } = useTranslation(['gateway', 'common'])
  const ticketsQuery = useMyTicketsQuery()
  const deleteTicket = useDeleteMyTicketMutation()
  const [createOpen, setCreateOpen] = useState(false)

  const tickets = ticketsQuery.data ?? []

  async function handleDelete(id: string) {
    try {
      await deleteTicket.mutateAsync(id)
      toast.success(t('gateway:tickets.deleteSuccess'))
    }
    catch {
      toast.error(t('gateway:tickets.deleteError'))
    }
  }

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={t('gateway:pages.tickets')}
        actions={(
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1" />
            {t('gateway:tickets.create')}
          </Button>
        )}
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('gateway:tickets.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsQuery.isPending && <p className="text-sm text-muted-foreground">{t('common:actions.loading')}</p>}
          {ticketsQuery.isSuccess && tickets.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('gateway:tickets.empty')}</p>
          )}
          {tickets.map(ticket => (
            <TicketRow key={ticket.id} ticket={ticket} onDelete={id => void handleDelete(id)} />
          ))}
        </CardContent>
      </Card>

      <CreateTicketDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
