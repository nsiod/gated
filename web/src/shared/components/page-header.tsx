import { cn } from '@/shared/lib/utils'

interface PageHeaderProps {
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-4 flex min-w-0 items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        <h1 className="break-words text-xl font-semibold tracking-tight">{title}</h1>
        {description != null && description !== '' && (
          <p className="mt-1 break-words text-muted-foreground">{description}</p>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
