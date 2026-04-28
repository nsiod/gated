export type GroupColor = 'Primary' | 'Secondary' | 'Success' | 'Danger' | 'Warning' | 'Info' | 'Light' | 'Dark'

const COLOR_CLASS_MAP: Record<GroupColor, string> = {
  Primary: 'bg-tone-blue text-tone-blue-fg border-tone-blue',
  Secondary: 'bg-tone-slate text-tone-slate-fg border-tone-slate',
  Success: 'bg-tone-green text-tone-green-fg border-tone-green',
  Danger: 'bg-tone-red text-tone-red-fg border-tone-red',
  Warning: 'bg-tone-amber text-tone-amber-fg border-tone-amber',
  Info: 'bg-tone-teal text-tone-teal-fg border-tone-teal',
  Light: 'bg-muted text-muted-foreground border-border',
  Dark: 'bg-foreground text-background border-foreground',
}

export function groupColorClass(color: string | null | undefined): string {
  if (color == null || color === '')
    return ''
  return COLOR_CLASS_MAP[color as GroupColor] ?? ''
}
