import { Link2, Link2Off, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAutoLinkUserToLdapMutation, useUnlinkUserFromLdapMutation, useUser } from '@/features/admin/api'
import { ConfirmDialog } from '@/shared/components/confirm-dialog'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function LdapCard({ userId }: { userId: string }) {
  const { t } = useTranslation('admin')
  const { data: user } = useUser(userId)
  const unlink = useUnlinkUserFromLdapMutation()
  const autoLink = useAutoLinkUserToLdapMutation()
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  async function handleAutoLink() {
    try {
      await autoLink.mutateAsync(userId)
      toast.success(t('users.ldap.autoLinkSuccess'))
    }
    catch {
      toast.error(t('users.ldap.autoLinkError'))
    }
  }

  async function handleUnlink() {
    try {
      await unlink.mutateAsync(userId)
      toast.success(t('users.ldap.unlinkSuccess'))
    }
    catch {
      toast.error(t('users.ldap.unlinkError'))
    }
    finally {
      setConfirmUnlink(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4" />
          {t('users.ldap.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {user?.ldap_server_id != null && user.ldap_server_id !== ''
          ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t('users.ldap.linked')}</p>
                  <p className="text-xs text-muted-foreground font-mono">{user.ldap_server_id}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setConfirmUnlink(true)}>
                  <Link2Off className="h-4 w-4 mr-2" />
                  {t('users.ldap.unlink')}
                </Button>
              </div>
            )
          : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t('users.ldap.notLinked')}</p>
                <Button variant="outline" size="sm" onClick={() => void handleAutoLink()} disabled={autoLink.isPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {autoLink.isPending ? t('users.ldap.autoLinking') : t('users.ldap.autoLink')}
                </Button>
              </div>
            )}
      </CardContent>
      <ConfirmDialog
        open={confirmUnlink}
        onOpenChange={setConfirmUnlink}
        title={t('users.ldap.unlinkTitle')}
        description={t('users.ldap.unlinkDescription')}
        confirmLabel={t('users.ldap.unlink')}
        onConfirm={() => void handleUnlink()}
      />
    </Card>
  )
}
