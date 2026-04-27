export type TargetKind = 'Ssh' | 'Kubernetes' | 'MySql' | 'Postgres' | 'WebAdmin' | 'Api'

const CLASS_MAP: Record<TargetKind, string> = {
  Ssh: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Kubernetes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MySql: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  Postgres: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  WebAdmin: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  Api: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
}

export function targetTypeClass(kind: string): string {
  return CLASS_MAP[kind as TargetKind] ?? ''
}
