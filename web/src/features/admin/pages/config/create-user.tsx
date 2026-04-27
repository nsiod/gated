import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { adminKeys, useCreateUser, useRoles } from '@/features/admin/api'
import { api } from '@/features/admin/lib/api'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  description: z.string().optional(),
  roleIds: z.array(z.string()),
})

type FormValues = z.infer<typeof schema>

export function Component() {
  const { t } = useTranslation(['admin', 'common'])
  const tc = (key: string) => t(key, { ns: 'common' })
  const navigate = useNavigate()
  const createUser = useCreateUser()
  const queryClient = useQueryClient()
  const { data: roles, isLoading: rolesLoading } = useRoles()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: '', description: '', roleIds: [] },
  })

  async function onSubmit(values: FormValues) {
    try {
      const user = await createUser.mutateAsync({
        username: values.username,
        description: values.description != null && values.description !== '' ? values.description : undefined,
      })
      if (values.roleIds.length > 0) {
        const results = await Promise.allSettled(
          values.roleIds.map(async roleId => api.addUserRole(user.id, roleId)),
        )
        const failed = results.filter(r => r.status === 'rejected').length
        if (failed > 0)
          toast.error(t('users.credentials.role.addError'))
        void queryClient.invalidateQueries({ queryKey: adminKeys.userRoles(user.id) })
        for (const roleId of values.roleIds)
          void queryClient.invalidateQueries({ queryKey: adminKeys.roleUsers(roleId) })
      }
      toast.success(t('users.created'))
      void navigate(`/ui/admin/config/users/${user.id}`)
    }
    catch {
      toast.error(t('users.createError'))
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader title={t('users.create')} description={t('users.createDescription')} />

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={e => void form.handleSubmit(onSubmit)(e)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.fields.username')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('users.fields.usernamePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.fields.description')}</FormLabel>
                    <FormControl>
                      <Textarea placeholder={t('users.fields.descriptionPlaceholder')} rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.fields.roles')}</FormLabel>
                    {rolesLoading
                      ? (
                          <p className="text-sm text-muted-foreground">{tc('actions.loading')}</p>
                        )
                      : roles == null || roles.length === 0
                        ? (
                            <p className="text-sm text-muted-foreground">{t('users.fields.rolesEmpty')}</p>
                          )
                        : (
                            <div className="space-y-2 max-h-64 overflow-y-auto rounded-md border p-3">
                              {roles.map((role) => {
                                const checked = field.value.includes(role.id)
                                return (
                                  <label
                                    key={role.id}
                                    className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded p-1"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(next) => {
                                        const isChecked = next === true
                                        field.onChange(
                                          isChecked
                                            ? [...field.value, role.id]
                                            : field.value.filter(id => id !== role.id),
                                        )
                                      }}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium leading-none">{role.name}</p>
                                      {role.description && (
                                        <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                                      )}
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? tc('actions.loading') : t('users.create')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void navigate('/ui/admin/config/users')}
                >
                  {tc('actions.cancel')}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
