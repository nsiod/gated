export type TargetKind = 'Ssh' | 'Kubernetes' | 'MySql' | 'Postgres' | 'WebAdmin' | 'Api'

const CLASS_MAP: Record<TargetKind, string> = {
  Ssh: 'bg-tone-blue text-tone-blue-fg border-tone-blue',
  Kubernetes: 'bg-tone-green text-tone-green-fg border-tone-green',
  MySql: 'bg-tone-orange text-tone-orange-fg border-tone-orange',
  Postgres: 'bg-tone-indigo text-tone-indigo-fg border-tone-indigo',
  WebAdmin: 'bg-tone-slate text-tone-slate-fg border-tone-slate',
  Api: 'bg-tone-amber text-tone-amber-fg border-tone-amber',
}

const FG_CLASS_MAP: Record<TargetKind, string> = {
  Ssh: 'text-tone-blue-fg',
  Kubernetes: 'text-tone-green-fg',
  MySql: 'text-tone-orange-fg',
  Postgres: 'text-tone-indigo-fg',
  WebAdmin: 'text-muted-foreground',
  Api: 'text-tone-amber-fg',
}

export function targetTypeClass(kind: string): string {
  return CLASS_MAP[kind as TargetKind] ?? ''
}

export function targetKindFgClass(kind: TargetKind): string {
  return FG_CLASS_MAP[kind] ?? 'text-muted-foreground'
}
