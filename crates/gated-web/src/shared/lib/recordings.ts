export type RecordingMetadata
  = | { type: 'kubernetes-exec', namespace: string, pod: string, container: string, command: string }
    | { type: 'kubernetes-attach', namespace: string, pod: string, container: string }
    | { type: 'sql-console-session', target_kind: string, target: string }
    | { type: 'mysql-terminal', target: string }
    | { type: 'mysql-proxy-session', target: string, database: string | null }
    | { type: 'postgres-terminal', target: string }
    | { type: 'postgres-proxy-session', target: string, database: string | null }
    | { type: 'ssh-shell', channel: number }
    | { type: 'ssh-exec', channel: number }
    | { type: 'ssh-direct-tcpip', host: string, port: number }
    | { type: 'ssh-direct-socket', path: string }
    | { type: 'ssh-forwarded-tcpip', host: string, port: number }
    | { type: 'ssh-forwarded-socket', path: string }

export function recordingMetadataToFieldSet(metadata: RecordingMetadata): [string, string][] {
  const fieldSets: [string, string][] = []

  switch (metadata.type) {
    case 'kubernetes-exec':
      fieldSets.push(['Namespace', metadata.namespace])
      fieldSets.push(['Pod', metadata.pod])
      fieldSets.push(['Container', metadata.container])
      fieldSets.push(['Command', metadata.command])
      break
    case 'kubernetes-attach':
      fieldSets.push(['Namespace', metadata.namespace])
      fieldSets.push(['Pod', metadata.pod])
      fieldSets.push(['Container', metadata.container])
      break
    case 'sql-console-session':
      fieldSets.push(['Target', metadata.target])
      fieldSets.push(['Target Kind', metadata.target_kind])
      break
    case 'mysql-terminal':
    case 'postgres-terminal':
      fieldSets.push(['Target', metadata.target])
      break
    case 'mysql-proxy-session':
    case 'postgres-proxy-session':
      fieldSets.push(['Target', metadata.target])
      if (metadata.database)
        fieldSets.push(['Database', metadata.database])
      break
    case 'ssh-shell':
    case 'ssh-exec':
      fieldSets.push(['Channel', metadata.channel.toString()])
      break
    case 'ssh-direct-tcpip':
    case 'ssh-forwarded-tcpip':
      fieldSets.push(['Host', metadata.host])
      fieldSets.push(['Port', metadata.port.toString()])
      break
    case 'ssh-direct-socket':
    case 'ssh-forwarded-socket':
      fieldSets.push(['Path', metadata.path])
      break
  }

  return fieldSets
}

export function recordingTypeLabel(metadata: string): string {
  const parsed = JSON.parse(metadata) as RecordingMetadata | null
  switch (parsed?.type) {
    case undefined:
      return 'Unknown type'
    case 'kubernetes-exec':
      return 'Exec'
    case 'kubernetes-attach':
      return 'Attach'
    case 'sql-console-session':
      return 'SQL Console Session'
    case 'mysql-terminal':
      return 'MySQL Terminal'
    case 'mysql-proxy-session':
      return 'MySQL Proxy Session'
    case 'postgres-terminal':
      return 'Postgres Terminal'
    case 'postgres-proxy-session':
      return 'Postgres Proxy Session'
    case 'ssh-shell':
      return 'Shell'
    case 'ssh-exec':
      return 'Exec'
    case 'ssh-direct-tcpip':
      return 'Local TCP forwarding'
    case 'ssh-direct-socket':
      return 'Local UNIX socket forwarding'
    case 'ssh-forwarded-tcpip':
      return 'Remote TCP forwarding'
    case 'ssh-forwarded-socket':
      return 'Remote UNIX socket forwarding'
    default:
      return 'Unknown type'
  }
}
