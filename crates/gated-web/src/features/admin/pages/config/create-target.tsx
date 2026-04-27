import type { FormValues } from './target-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useAddTargetRole, useCreateTarget, useRoles, useTargetGroupsQuery } from '@/features/admin/api'
import { PageHeader } from '@/shared/components/page-header'
import { buildRequest, EMPTY_DEFAULTS, TargetForm } from './target-form'

export function Component() {
  const { t } = useTranslation('admin')
  const navigate = useNavigate()
  const createMutation = useCreateTarget()
  const addRoleMutation = useAddTargetRole()
  const { data: groups = [] } = useTargetGroupsQuery()
  const { data: roles = [] } = useRoles()

  function onSubmit(values: FormValues) {
    createMutation.mutate(buildRequest(values), {
      onSuccess: (target) => {
        void (async () => {
          for (const roleId of values.role_ids) {
            await addRoleMutation.mutateAsync({ targetId: target.id, roleId })
          }
          void navigate(`/ui/admin/config/targets/${target.id}`)
        })()
      },
    })
  }

  const isSubmitting = createMutation.isPending || addRoleMutation.isPending

  return (
    <div className="max-w-2xl">
      <PageHeader title={t('targets.create')} description={t('targets.createDescription')} />
      <TargetForm
        defaultValues={EMPTY_DEFAULTS}
        groups={groups}
        roles={roles}
        onSubmit={onSubmit}
        isSubmitting={isSubmitting}
        submitLabel={t('targets.create')}
      />
    </div>
  )
}
