import { cn } from '@/shared/lib/utils'

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        {description != null && description !== '' && (
          <p className="break-words text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
