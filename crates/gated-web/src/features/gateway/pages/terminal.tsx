import type { HostKeyPrompt, TerminalKind } from '@/features/gateway/lib/terminal-sessions'
import { ArrowLeft, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { closeSession, useTerminalSession } from '@/features/gateway/lib/terminal-sessions'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'
import { getCliTerminalBackground } from '@/shared/lib/terminal-theme'
import '@xterm/xterm/css/xterm.css'

export function Component() {
  const { targetName } = useParams<{ targetName: string }>()

  if (targetName == null || targetName === '')
    return null

  return <TerminalView kind="ssh" targetName={targetName} />
}

export function TerminalView({ kind, targetName }: { kind: TerminalKind, targetName: string }) {
  const { t } = useTranslation(['gateway', 'common'])
  const navigate = useNavigate()
  const resolvedTheme = useResolvedTheme()
  const session = useTerminalSession(kind, targetName, resolvedTheme)
  const slotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slot = slotRef.current
    if (slot == null)
      return
    slot.appendChild(session.container)
    session.fit()

    const handleResize = () => session.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (session.container.parentElement === slot)
        slot.removeChild(session.container)
    }
  }, [session])

  function handleClose() {
    closeSession(kind, targetName)
    void navigate('/ui')
  }

  const statusColor: Record<typeof session.status, 'default' | 'secondary' | 'destructive'> = {
    connecting: 'secondary',
    connected: 'default',
    disconnected: 'destructive',
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: getCliTerminalBackground(resolvedTheme) }}>
      <div className="flex items-center justify-between shrink-0 px-3 h-10 bg-background border-b border-border">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="size-7" render={<Link to="/ui" />}>
            <ArrowLeft className="size-3.5" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {targetName}
          </span>
          <Badge variant={statusColor[session.status]} className="text-xs">
            {t(`gateway:terminal.status.${session.status}`)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {session.status === 'disconnected' && (
            <Button size="sm" variant="ghost" onClick={() => session.reconnect()} className="h-7 text-xs">
              <RefreshCw className="size-3 mr-1" />
              {t('gateway:terminal.reconnect')}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleClose} className="h-7 text-xs text-destructive hover:text-destructive">
            <X className="size-3 mr-1" />
            {t('gateway:terminal.close')}
          </Button>
        </div>
      </div>
      <div
        ref={slotRef}
        className="flex-1 overflow-hidden"
        style={{ minHeight: 0 }}
      />
      <HostKeyPromptDialog
        prompt={session.hostKeyPrompt}
        onDecide={accepted => session.respondHostKey(accepted)}
      />
    </div>
  )
}

interface HostKeyPromptDialogProps {
  prompt: HostKeyPrompt | null
  onDecide: (accepted: boolean) => void
}

function HostKeyPromptDialog({ prompt, onDecide }: HostKeyPromptDialogProps) {
  const { t } = useTranslation(['gateway'])
  if (prompt == null)
    return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-xl">
        <h2 className="text-base font-semibold mb-1 text-foreground">
          {t('gateway:terminal.hostKey.title')}
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          {t('gateway:terminal.hostKey.description')}
        </p>
        <div className="space-y-2 text-xs font-mono bg-muted rounded p-3 mb-4 break-all">
          <div>
            <span className="text-muted-foreground mr-2">
              {t('gateway:terminal.hostKey.algorithm')}
            </span>
            <span className="text-foreground">{prompt.algorithm}</span>
          </div>
          <div>
            <span className="text-muted-foreground mr-2">
              {t('gateway:terminal.hostKey.key')}
            </span>
            <span className="text-foreground">{prompt.key_base64}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => onDecide(false)}>
            {t('gateway:terminal.hostKey.reject')}
          </Button>
          <Button size="sm" onClick={() => onDecide(true)}>
            {t('gateway:terminal.hostKey.accept')}
          </Button>
        </div>
      </div>
    </div>
  )
}
