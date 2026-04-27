import { zodResolver } from '@hookform/resolvers/zod'
import { UserCog } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useUpdateUser, useUser } from '@/features/admin/api'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
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

const editSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  description: z.string().optional(),
  rate_limit_bytes_per_second: z.string().optional(),
})
type EditFormValues = z.infer<typeof editSchema>

export function EditUserCard({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { data: user, isLoading } = useUser(userId)
  const updateUser = useUpdateUser(userId)

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    values: user
      ? {
          username: user.username,
          description: user.description || '',
          rate_limit_bytes_per_second: user.rate_limit_bytes_per_second != null
            ? String(user.rate_limit_bytes_per_second)
            : '',
        }
      : undefined,
  })

  async function onSubmit(values: EditFormValues) {
    try {
      await updateUser.mutateAsync({
        username: values.username,
        description: values.description != null && values.description !== '' ? values.description : undefined,
        rate_limit_bytes_per_second:
          values.rate_limit_bytes_per_second === '' || values.rate_limit_bytes_per_second === undefined
            ? undefined
            : Number(values.rate_limit_bytes_per_second),
      })
      toast.success(t('users.updated'))
    }
    catch {
      toast.error(t('users.updateError'))
    }
  }

  if (isLoading)
    return <Skeleton className="h-32 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCog className="h-4 w-4" />
          {t('users.editUser')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.fields.username')}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rate_limit_bytes_per_second"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.fields.rateLimit')}</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder={t('users.fields.rateLimitPlaceholder')} {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.fields.description')}</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={updateUser.isPending}>
                {updateUser.isPending ? tc('actions.loading') : tc('actions.save')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
