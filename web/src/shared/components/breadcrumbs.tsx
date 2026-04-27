import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useMatches } from 'react-router'

interface Crumb {
  key: string
  to: string
  params: Record<string, string | undefined>
}

export function Breadcrumbs() {
  const { t } = useTranslation()
  const matches = useMatches()

  const crumbs: Crumb[] = matches
    .filter((m): m is typeof m & { handle: { breadcrumbKey: string } } =>
      m.handle != null
      && typeof m.handle === 'object'
      && 'breadcrumbKey' in m.handle
      && typeof (m.handle as { breadcrumbKey: unknown }).breadcrumbKey === 'string',
    )
    .map(m => ({ key: m.handle.breadcrumbKey, to: m.pathname, params: m.params }))

  if (crumbs.length === 0)
    return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        const label = t(crumb.key, crumb.params)
        return (
          <Fragment key={crumb.to}>
            {i > 0 && <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground/60" />}
            {isLast
              ? <span className="font-medium text-foreground">{label}</span>
              : <Link to={crumb.to} className="hover:text-foreground transition-colors">{label}</Link>}
          </Fragment>
        )
      })}
    </nav>
  )
}
