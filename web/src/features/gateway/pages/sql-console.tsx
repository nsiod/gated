import { useQuery } from '@tanstack/react-query'
import { Database, Lock, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { api } from '@/features/gateway/lib/api'
import { DatabaseConsole } from '@/shared/components/database-console'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

function StandaloneConsole({ kind, targetName }: { kind: 'mysql' | 'postgres', targetName: string }) {
  const { t } = useTranslation('gateway')
  const navigate = useNavigate()
  const schemasQuery = useQuery({
    queryKey: ['sql', 'schemas', targetName],
    queryFn: async () => api.getDbSchemas(targetName),
    retry: false,
    staleTime: 60_000,
  })
  const readonly = schemasQuery.data?.readonly ?? false
  const dbKindLabel = kind === 'mysql' ? 'MySQL' : 'PostgreSQL'

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Database className="size-4 text-primary" />
        <span className="font-semibold">{targetName}</span>
        <Badge variant="outline">{dbKindLabel}</Badge>
        {readonly && (
          <Badge variant="outline" className="gap-1 border-warning-foreground/30 bg-warning text-warning-foreground">
            <Lock className="size-3" />
            {t('sqlConsole.readonly')}
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { void navigate('/ui') }}>
            <X className="size-4" />
            {t('sqlConsole.close')}
          </Button>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <DatabaseConsole kind={kind} targetName={targetName} />
      </div>
    </div>
  )
}

export function Component() {
  const { kind, targetName } = useParams<{ kind: string, targetName: string }>()
  if (targetName == null || targetName === '')
    return null
  if (kind !== 'mysql' && kind !== 'postgres')
    return null
  return <StandaloneConsole kind={kind} targetName={targetName} />
}
