import { shellEscape } from '@/shared/lib/shell-escape'

interface Ports {
  ssh?: number
  mysql?: number
  postgres?: number
  kubernetes?: number
}

interface ConnectionInput {
  targetName: string
  username?: string
  externalHost?: string
  ports?: Ports
  defaultDatabase?: string
}

function gatedLogin({ targetName, username }: ConnectionInput): string {
  return username != null && username !== '' ? `${username}:${targetName}` : targetName
}

function host({ externalHost }: ConnectionInput): string {
  return externalHost ?? 'gateway'
}

export function buildSshCommand(input: ConnectionInput): string {
  const port = input.ports?.ssh
  const portFlag = port != null && port !== 0 && port !== 22 ? ['-p', String(port)] : []
  return shellEscape(['ssh', ...portFlag, '-l', gatedLogin(input), host(input)])
}

export function buildMySqlCommand(input: ConnectionInput): string {
  const port = input.ports?.mysql
  const args = ['mysql', '--ssl-mode=REQUIRED', '--enable-cleartext-plugin', '-h', host(input)]
  if (port != null && port !== 0 && port !== 3306)
    args.push('-P', String(port))
  args.push('-u', gatedLogin(input), '-p')
  if (input.defaultDatabase != null && input.defaultDatabase !== '')
    args.push(input.defaultDatabase)
  return shellEscape(args)
}

export function buildPostgresCommand(input: ConnectionInput): string {
  const port = input.ports?.postgres
  const args = ['psql', '-h', host(input)]
  if (port != null && port !== 0 && port !== 5432)
    args.push('-p', String(port))
  args.push('-U', gatedLogin(input))
  if (input.defaultDatabase != null && input.defaultDatabase !== '')
    args.push('-d', input.defaultDatabase)
  return shellEscape(args)
}
