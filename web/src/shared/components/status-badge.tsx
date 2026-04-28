import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

type StatusVariant = 'active' | 'inactive' | 'enabled' | 'disabled' | 'success' | 'warning' | 'error' | 'pending' | 'default'

interface StatusBadgeProps {
  status: StatusVariant | string
  label?: string
  className?: string
}

const statusConfig: Record<string, { label: string, surface: string, dot: string }> = {
  active: {
    label: 'Active',
    surface: 'bg-success text-success-foreground border-success-foreground/25',
    dot: 'bg-success-foreground',
  },
  inactive: {
    label: 'Inactive',
    surface: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/60',
  },
  enabled: {
    label: 'Enabled',
    surface: 'bg-success text-success-foreground border-success-foreground/25',
    dot: 'bg-success-foreground',
  },
  disabled: {
    label: 'Disabled',
    surface: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/60',
  },
  success: {
    label: 'Success',
    surface: 'bg-success text-success-foreground border-success-foreground/25',
    dot: 'bg-success-foreground',
  },
  warning: {
    label: 'Warning',
    surface: 'bg-warning text-warning-foreground border-warning-foreground/25',
    dot: 'bg-warning-foreground',
  },
  error: {
    label: 'Error',
    surface: 'bg-destructive/10 text-destructive border-destructive/30 dark:bg-destructive/20',
    dot: 'bg-destructive',
  },
  pending: {
    label: 'Pending',
    surface: 'bg-info text-info-foreground border-info-foreground/25',
    dot: 'bg-info-foreground animate-pulse',
  },
  default: {
    label: 'Unknown',
    surface: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground/60',
  },
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.default!
  const displayLabel = label ?? config.label ?? status

  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', config.surface, className)}>
      <span className={cn('size-1.5 rounded-full shrink-0', config.dot)} />
      {displayLabel}
    </Badge>
  )
}
