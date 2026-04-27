import { useParams } from 'react-router'
import { TerminalView } from './terminal'

export function Component() {
  const { kind, targetName } = useParams<{ kind: string, targetName: string }>()

  if (targetName == null || targetName === '')
    return null
  if (kind !== 'mysql' && kind !== 'postgres')
    return null

  return <TerminalView kind={kind} targetName={targetName} />
}
