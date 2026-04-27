import { AlertTriangle, ArrowLeft, House, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useRouteError } from 'react-router'
import { summarizeRouteError } from '@/app/global-error-page.lib'
import { LanguageToggle } from '@/shared/components/language-toggle'
import { ModeToggle } from '@/shared/components/mode-toggle'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

function isChunkLoadFailure(message: string): boolean {
  return (
    message.includes('Failed to fetch dynamically imported module')
    || message.includes('Importing a module script failed')
    || message.includes('error loading dynamically imported module')
  )
}

interface ErrorPageBodyProps {
  error: unknown
}

function ErrorPageBody({ error }: ErrorPageBodyProps) {
  const { t } = useTranslation('common')
  const message = summarizeRouteError(error)
  const descriptionKey = isChunkLoadFailure(message)
    ? 'errorPage.chunkDescription'
    : 'errorPage.genericDescription'

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_color-mix(in_oklab,_var(--color-primary)_18%,_transparent),_transparent_68%)]" />
        <div className="absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(180deg,_transparent,_color-mix(in_oklab,_var(--color-muted)_72%,_transparent))]" />
        <div className="absolute left-1/2 top-24 h-40 w-40 -translate-x-1/2 rounded-full border border-primary/15 bg-primary/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2">
          <Link to="/ui" className="inline-flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <AlertTriangle className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold tracking-tight">{t('appName')}</p>
              <p className="text-sm text-muted-foreground">{t('errorPage.kicker')}</p>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ModeToggle />
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-8 sm:py-12">
          <Card className="w-full max-w-3xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-sm">
            <CardHeader className="gap-4 border-b border-border/60 pb-6 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
                <AlertTriangle className="size-8" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-[0.24em] text-muted-foreground uppercase">
                  {t('errorPage.eyebrow')}
                </p>
                <CardTitle className="text-2xl sm:text-3xl">{t('errorPage.title')}</CardTitle>
                <CardDescription className="mx-auto max-w-2xl text-sm leading-6 sm:text-base">
                  {t(descriptionKey)}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-left">
                <p className="mb-2 text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  {t('errorPage.messageLabel')}
                </p>
                <p className="break-all font-mono text-xs leading-6 text-foreground/85 sm:text-sm">{message}</p>
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button className="cursor-pointer" onClick={() => window.location.reload()}>
                  <RefreshCw className="size-4" />
                  {t('errorPage.actions.retry')}
                </Button>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  render={<Link to="/ui" replace />}
                >
                  <House className="size-4" />
                  {t('errorPage.actions.dashboard')}
                </Button>
                <Button
                  variant="ghost"
                  className="cursor-pointer"
                  onClick={() => window.history.back()}
                >
                  <ArrowLeft className="size-4" />
                  {t('errorPage.actions.back')}
                </Button>
              </div>

              <details className="group rounded-2xl border border-border/70 bg-background/80 p-4">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground marker:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span>{t('errorPage.details')}</span>
                    <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">
                      ^
                    </span>
                  </span>
                </summary>
                <div className="pt-3 text-sm leading-6 text-muted-foreground">
                  <p>{t('errorPage.detailsHelp')}</p>
                </div>
              </details>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}

export function GlobalErrorPage() {
  const error = useRouteError()
  return <ErrorPageBody error={error} />
}

export function GlobalErrorPagePreview({ error }: { error: unknown }) {
  return <ErrorPageBody error={error} />
}
