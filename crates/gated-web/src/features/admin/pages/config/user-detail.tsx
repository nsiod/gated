import {
  Award,
  FileBadge,
  KeyIcon,
  KeyRound,
  Mail,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useDeleteUser, useUser } from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ApiTokensTab } from './user-detail-parts/api-tokens-tab'
import { CertificatesTab } from './user-detail-parts/certificates-tab'
import { EditUserCard } from './user-detail-parts/edit-user-card'
import { LdapCard } from './user-detail-parts/ldap-card'
import { OtpTab } from './user-detail-parts/otp-tab'
import { PasswordsTab } from './user-detail-parts/passwords-tab'
import { PublicKeysTab } from './user-detail-parts/public-keys-tab'
import { RolesTab } from './user-detail-parts/roles-tab'
import { SsoTab } from './user-detail-parts/sso-tab'

export function Component() {
  const { t } = useTranslation('admin')
  const { t: tc } = useTranslation('common')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: user, isLoading } = useUser(id!)
  const deleteUser = useDeleteUser()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  async function handleDeleteUser() {
    if (!user)
      return
    try {
      await deleteUser.mutateAsync(user.id)
      toast.success(t('users.deleted'))
      void navigate('/ui/admin/config/users')
    }
    catch {
      toast.error(t('users.deleteError'))
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!user) {
    return <EmptyState icon={User} title={t('users.notFound')} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.username}
        description={user.description || undefined}
        actions={(
          <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('users.deleteUser')}
          </Button>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EditUserCard userId={user.id} />
        </div>
        <div>
          <LdapCard userId={user.id} />
        </div>
      </div>

      <Separator />

      <Tabs defaultValue="passwords">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="passwords">
            <KeyRound className="h-4 w-4 mr-1.5" />
            {t('users.credentials.passwords')}
          </TabsTrigger>
          <TabsTrigger value="public-keys">
            <ShieldCheck className="h-4 w-4 mr-1.5" />
            {t('users.credentials.publicKeys')}
          </TabsTrigger>
          <TabsTrigger value="otp">
            <Smartphone className="h-4 w-4 mr-1.5" />
            {t('users.credentials.otp')}
          </TabsTrigger>
          <TabsTrigger value="certificates">
            <FileBadge className="h-4 w-4 mr-1.5" />
            {t('users.credentials.certificates')}
          </TabsTrigger>
          <TabsTrigger value="sso">
            <Mail className="h-4 w-4 mr-1.5" />
            {t('users.credentials.sso')}
          </TabsTrigger>
          <TabsTrigger value="api-tokens">
            <KeyIcon className="h-4 w-4 mr-1.5" />
            {t('users.credentials.apiTokens')}
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Award className="h-4 w-4 mr-1.5" />
            {t('users.credentials.roles')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="passwords" className="mt-4"><PasswordsTab userId={user.id} /></TabsContent>
        <TabsContent value="public-keys" className="mt-4"><PublicKeysTab userId={user.id} /></TabsContent>
        <TabsContent value="otp" className="mt-4"><OtpTab userId={user.id} username={user.username} /></TabsContent>
        <TabsContent value="certificates" className="mt-4"><CertificatesTab userId={user.id} /></TabsContent>
        <TabsContent value="sso" className="mt-4"><SsoTab userId={user.id} /></TabsContent>
        <TabsContent value="api-tokens" className="mt-4"><ApiTokensTab userId={user.id} /></TabsContent>
        <TabsContent value="roles" className="mt-4"><RolesTab userId={user.id} /></TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t('users.deleteTitle')}
        description={t('users.deleteDescription')}
        confirmLabel={tc('actions.delete')}
        onConfirm={() => void handleDeleteUser()}
      />
    </div>
  )
}
