import type { RecordingMetadata } from '@/shared/lib/recordings'
import { format } from 'date-fns'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { useRecordingApiQuery, useRecordingCastQuery, useRecordingQuery } from '@/features/admin/api'
import { PageHeader } from '@/shared/components/page-header'
import { TerminalPlayer } from '@/shared/components/terminal-player'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { recordingMetadataToFieldSet, recordingTypeLabel } from '@/shared/lib/recordings'

function safeParseMetadata(raw: string): RecordingMetadata | null {
  try {
    return JSON.parse(raw) as RecordingMetadata
  }
  catch {
    return null
  }
}

export function Component() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation('admin')

  const recordingQuery = useRecordingQuery(id!)
  const recording = recordingQuery.data
  const isTerminal = recording?.kind === 'Terminal'
  const isApi = recording?.kind === 'Api'

  const castQuery = useRecordingCastQuery(id!, isTerminal ?? false)
  const apiQuery = useRecordingApiQuery(id!, isApi ?? false)

  if (recordingQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('recording.title')} />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (recordingQuery.isError || !recording) {
    return (
      <div>
        <PageHeader title={t('recording.title')} />
        <p className="text-destructive text-sm">{t('recording.loadError')}</p>
      </div>
    )
  }

  const metadata = safeParseMetadata(recording.metadata)
  const metadataFields = metadata ? recordingMetadataToFieldSet(metadata) : []

  return (
    <div className="space-y-6">
      <PageHeader title={recording.name != null && recording.name !== '' ? recording.name : t('recording.title')} />

      {/* Metadata card */}
      <Card className="min-w-0 max-w-full">
        <CardHeader>
          <CardTitle>{t('recording.metadata')}</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 max-w-full">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">{t('recording.fields.type')}</dt>
            <dd className="min-w-0 break-words">{recordingTypeLabel(recording.metadata)}</dd>

            <dt className="text-muted-foreground">{t('recording.fields.kind')}</dt>
            <dd className="min-w-0 break-words">{recording.kind}</dd>

            <dt className="text-muted-foreground">{t('recording.fields.started')}</dt>
            <dd className="min-w-0 break-words">{format(new Date(recording.started), 'PPpp')}</dd>

            {recording.ended != null && recording.ended !== '' && (
              <>
                <dt className="text-muted-foreground">{t('recording.fields.ended')}</dt>
                <dd className="min-w-0 break-words">{format(new Date(recording.ended), 'PPpp')}</dd>
              </>
            )}

            <dt className="text-muted-foreground">{t('recording.fields.session')}</dt>
            <dd className="font-mono text-xs break-all">{recording.session_id}</dd>

            {metadataFields.map(([key, value]) => (
              <Fragment key={key}>
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="min-w-0 break-words">{value}</dd>
              </Fragment>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Terminal player card (only for Terminal recordings) */}
      {isTerminal && (
        <Card className="min-w-0 max-w-full">
          <CardHeader>
            <CardTitle>{t('recording.player')}</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 max-w-full">
            {castQuery.isLoading && <Skeleton className="h-64 w-full" />}
            {castQuery.isError && (
              <p className="text-destructive text-sm">{t('recording.castError')}</p>
            )}
            {castQuery.data != null && castQuery.data !== '' && (
              <TerminalPlayer castText={castQuery.data} />
            )}
          </CardContent>
        </Card>
      )}

      {isApi && (
        <Card className="min-w-0 max-w-full">
          <CardHeader>
            <CardTitle>SQL Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 min-w-0 max-w-full">
            {apiQuery.isLoading && <Skeleton className="h-64 w-full" />}
            {apiQuery.isError && (
              <p className="text-destructive text-sm">Failed to load API recording details.</p>
            )}
            {apiQuery.data?.map((item, index) => (
              <div key={`${item.timestamp}-${index}`} className="rounded border p-3 text-sm">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Time</dt>
                  <dd className="min-w-0 break-words">{format(new Date(item.timestamp), 'PPpp')}</dd>

                  <dt className="text-muted-foreground">Statement</dt>
                  <dd className="min-w-0 break-words">{item.statement_kind}</dd>

                  <dt className="text-muted-foreground">Target</dt>
                  <dd className="min-w-0 break-words">{item.target}</dd>

                  <dt className="text-muted-foreground">Target Kind</dt>
                  <dd className="min-w-0 break-words">{item.target_kind}</dd>

                  {item.database != null && item.database !== '' && (
                    <>
                      <dt className="text-muted-foreground">Database</dt>
                      <dd className="min-w-0 break-words">{item.database}</dd>
                    </>
                  )}

                  {item.readonly != null && (
                    <>
                      <dt className="text-muted-foreground">Readonly</dt>
                      <dd className="min-w-0 break-words">{item.readonly ? 'true' : 'false'}</dd>
                    </>
                  )}

                  <dt className="text-muted-foreground">Success</dt>
                  <dd className="min-w-0 break-words">{item.success ? 'true' : 'false'}</dd>

                  <dt className="text-muted-foreground">Elapsed (ms)</dt>
                  <dd className="min-w-0 break-words">{item.elapsed_ms}</dd>

                  <dt className="text-muted-foreground">SQL</dt>
                  <dd className="font-mono text-xs break-all whitespace-pre-wrap">{item.sql}</dd>

                  {item.error != null && item.error !== '' && (
                    <>
                      <dt className="text-muted-foreground">Error</dt>
                      <dd className="min-w-0 break-words text-destructive">{item.error}</dd>
                    </>
                  )}
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
