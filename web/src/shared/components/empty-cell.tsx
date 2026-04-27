import { cn } from '@/shared/lib/utils'

export function EmptyCell({ className }: { className?: string }) {
  return <span className={cn('text-muted-foreground/40', className)}>—</span>
}
