import type { Info, TargetSnapshot } from '@/features/gateway/lib/api-client'
import { Code2, Database, Globe, Search, Terminal } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useInfoQuery, useTargetsQuery } from '@/features/gateway/api'
import { CopyButton } from '@/shared/components/copy-button'
import { EmptyState } from '@/shared/components/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { buildMySqlCommand, buildPostgresCommand, buildSshCommand } from '@/shared/lib/connection-commands'
import { targetTypeClass } from '@/shared/lib/target-types'
import { cn } from '@/shared/lib/utils'

function TargetIcon({ kind }: { kind: TargetSnapshot['kind'] }) {
  if (kind === 'Ssh')
    return <Terminal className="size-4" />
  if (kind === 'MySql' || kind === 'Postgres')
    return <Database className="size-4" />
  return <Globe className="size-4" />
}

function connectionCommand(target: TargetSnapshot, info: Info | undefined): string | null {
  if (info == null)
    return null
  const input = {
    targetName: target.name,
    username: info.username,
    externalHost: info.external_host,
    ports: info.ports,
    defaultDatabase: target.default_database_name,
  }
  switch (target.kind) {
    case 'Ssh':
      return buildSshCommand(input)
    case 'MySql':
      return buildMySqlCommand(input)
    case 'Postgres':
      return buildPostgresCommand(input)
    case 'Kubernetes':
    case 'Api':
    case 'WebAdmin':
      return null
  }
}

function apiProxyCommand(target: TargetSnapshot, info: Info | undefined): string | null {
  if (target.kind !== 'Api')
    return null
  if (info?.external_host == null || info.external_host === '')
    return null
  return `curl -H 'X-Gated-Target: ${target.name}' -H 'x-gated-token: <TOKEN>' https://${info.external_host}/`
}

function TargetRow({ target, infoData }: { target: TargetSnapshot, infoData: Info | undefined }) {
  const { t } = useTranslation('gateway')

  const isSsh = target.kind === 'Ssh'
  const command = connectionCommand(target, infoData)
  const apiCommand = apiProxyCommand(target, infoData)
  const webAdminUrl = infoData?.external_host != null && infoData.external_host !== ''
    ? `https://${infoData.external_host}`
    : null

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <TargetIcon kind={target.kind} />
          <span className="font-medium">{target.name}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn('font-medium', targetTypeClass(target.kind))}>
          {t(`common:targetTypes.${target.kind}`, target.kind)}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {target.description ?? ''}
      </TableCell>
      <TableCell>
        {target.group != null && (
          <Badge variant="outline" className="text-xs">{target.group.name}</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {isSsh && (
            <>
              <Button render={<Link to={`/ui/ssh/${encodeURIComponent(target.name)}`} />} size="sm" variant="outline">
                <Terminal className="size-3.5 mr-1" />
                {t('targetList.openTerminal')}
              </Button>
              {command != null && <CopyButton value={command} label={t('targetList.copyCommand')} />}
            </>
          )}
          {target.kind === 'MySql' && (
            <>
              <Button render={<Link to={`/ui/db/mysql/${encodeURIComponent(target.name)}/console`} />} size="sm" variant="outline">
                <Code2 className="size-3.5 mr-1" />
                {t('targetList.openSqlConsole')}
              </Button>
              <Button render={<Link to={`/ui/db/mysql/${encodeURIComponent(target.name)}`} />} size="sm" variant="outline">
                <Terminal className="size-3.5 mr-1" />
                {t('targetList.openTerminal')}
              </Button>
              {command != null && <CopyButton value={command} label={t('targetList.copyCommand')} />}
            </>
          )}
          {target.kind === 'Postgres' && (
            <>
              <Button render={<Link to={`/ui/db/postgres/${encodeURIComponent(target.name)}/console`} />} size="sm" variant="outline">
                <Code2 className="size-3.5 mr-1" />
                {t('targetList.openSqlConsole')}
              </Button>
              <Button render={<Link to={`/ui/db/postgres/${encodeURIComponent(target.name)}`} />} size="sm" variant="outline">
                <Terminal className="size-3.5 mr-1" />
                {t('targetList.openTerminal')}
              </Button>
              {command != null && <CopyButton value={command} label={t('targetList.copyCommand')} />}
            </>
          )}
          {target.kind === 'Api' && apiCommand != null && (
            <>
              <span className="max-w-[20rem] truncate font-mono text-xs text-muted-foreground" title={apiCommand}>
                {apiCommand}
              </span>
              <CopyButton value={apiCommand} label={t('targetList.copyCommand')} />
            </>
          )}
          {target.kind === 'WebAdmin' && webAdminUrl != null && (
            <a
              href={webAdminUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              {webAdminUrl}
            </a>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead><Skeleton className="h-4 w-20" /></TableHead>
          <TableHead><Skeleton className="h-4 w-12" /></TableHead>
          <TableHead><Skeleton className="h-4 w-32" /></TableHead>
          <TableHead><Skeleton className="h-4 w-16" /></TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={`skeleton-${String(i)}`}>
            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
            <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
            <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
            <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function Component() {
  const { t } = useTranslation('gateway')
  const [search, setSearch] = useState('')
  const targetsQuery = useTargetsQuery(search || undefined)
  const infoQuery = useInfoQuery()

  const targets = (targetsQuery.data ?? []).filter(t => t.kind !== 'WebAdmin')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{t('pages.targetList')}</h1>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('targetList.search')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {targetsQuery.isPending && <TableSkeleton />}

      {targetsQuery.isSuccess && targets.length === 0 && (
        <EmptyState
          icon={Terminal}
          title={t('targetList.empty')}
        />
      )}

      {targets.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('targetList.colName', 'Name')}</TableHead>
              <TableHead>{t('targetList.colType', 'Type')}</TableHead>
              <TableHead>{t('targetList.colDescription', 'Description')}</TableHead>
              <TableHead>{t('targetList.colGroup', 'Group')}</TableHead>
              <TableHead className="text-right">{t('targetList.colActions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.map(target => (
              <TargetRow key={target.name} target={target} infoData={infoQuery.data} />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
