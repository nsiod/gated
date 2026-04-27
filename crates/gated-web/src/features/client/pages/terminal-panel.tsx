import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { useResolvedTheme } from '@/shared/hooks/use-resolved-theme'
import { useWebSocket } from '@/shared/hooks/use-web-socket'
import { getCliTerminalBackground, getCliTerminalTheme } from '@/shared/lib/terminal-theme'
import '@xterm/xterm/css/xterm.css'

const MSG_TERMINAL_DATA = 0x00
const MSG_RESIZE = 0x01
const MSG_HOST_KEY_VERIFY = 0x03

interface HostKeyPrompt {
  algorithm: string
  key_base64: string
}

function sendHostKeyResponse(send: (data: string | ArrayBuffer) => void, accepted: boolean) {
  const payload = new TextEncoder().encode(JSON.stringify({ accepted }))
  const frame = new Uint8Array(1 + payload.length)
  frame[0] = MSG_HOST_KEY_VERIFY
  frame.set(payload, 1)
  send(frame.buffer)
}

export type TerminalPanelKind = 'ssh' | 'mysql' | 'postgres'

function buildWsUrl(kind: TerminalPanelKind, targetName: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/api/${kind}/terminal/${encodeURIComponent(targetName)}`
}

interface TerminalPanelProps {
  targetName: string
  tabId: string
  isActive: boolean
  kind?: TerminalPanelKind
}

export function TerminalPanel({ targetName, tabId, isActive, kind = 'ssh' }: TerminalPanelProps) {
  const termDivRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const resolvedThemeRef = useRef<ReturnType<typeof getCliTerminalTheme>>(getCliTerminalTheme('dark'))
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPrompt | null>(null)
  const { t } = useTranslation(['gateway'])
  const resolvedTheme = useResolvedTheme()

  const wsUrl = buildWsUrl(kind, targetName)
  const sendRef = useRef<(data: string | ArrayBuffer) => void>(() => {})

  useEffect(() => {
    resolvedThemeRef.current = getCliTerminalTheme(resolvedTheme)
  }, [resolvedTheme])

  // Initialize xterm once
  useEffect(() => {
    if (!termDivRef.current)
      return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '\'JetBrains Mono\', \'Fira Code\', monospace',
      theme: resolvedThemeRef.current,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termDivRef.current)
    fitAddon.fit()

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    return () => {
      term.dispose()
      xtermRef.current = null
      fitAddonRef.current = null
    }
  }, [tabId])

  useEffect(() => {
    if (xtermRef.current != null)
      xtermRef.current.options.theme = getCliTerminalTheme(resolvedTheme)
  }, [resolvedTheme])

  // Re-fit when tab becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current != null) {
      const timeoutId = window.setTimeout(() => fitAddonRef.current?.fit(), 50)
      return () => window.clearTimeout(timeoutId)
    }
  }, [isActive])

  const handleOpen = useCallback(() => {
    setStatus('connected')
    xtermRef.current?.clear()
    const term = xtermRef.current
    const fitAddon = fitAddonRef.current
    if (term != null && fitAddon != null) {
      fitAddon.fit()
      const payload = JSON.stringify({ cols: term.cols, rows: term.rows })
      const encoder = new TextEncoder()
      const encoded = encoder.encode(payload)
      const frame = new Uint8Array(1 + encoded.length)
      frame[0] = MSG_RESIZE
      frame.set(encoded, 1)
      sendRef.current(frame.buffer)
    }
  }, [])

  const handleClose = useCallback(() => {
    setStatus('disconnected')
    xtermRef.current?.writeln('\r\n\x1B[31m[disconnected]\x1B[0m')
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data instanceof ArrayBuffer) {
      const view = new Uint8Array(event.data)
      if (view.length === 0)
        return
      const msgType = view[0]
      const payload = view.slice(1)

      if (msgType === MSG_TERMINAL_DATA) {
        xtermRef.current?.write(new TextDecoder().decode(payload))
      }
      else if (msgType === MSG_HOST_KEY_VERIFY) {
        try {
          const text = new TextDecoder().decode(payload)
          const msg = JSON.parse(text) as { algorithm?: string, key_base64?: string }
          if (msg.algorithm != null && msg.key_base64 != null) {
            setHostKeyPrompt({ algorithm: msg.algorithm, key_base64: msg.key_base64 })
          }
        }
        catch { /* ignore */ }
      }
      else {
        try {
          const text = new TextDecoder().decode(payload)
          const msg = JSON.parse(text) as { status?: string, message?: string }
          if (msg.status === 'error' || msg.status === 'closed') {
            xtermRef.current?.writeln(`\r\n\x1B[33m[${msg.message ?? msg.status}]\x1B[0m`)
          }
        }
        catch { /* ignore */ }
      }
    }
    else if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((buf) => {
        handleMessage({ data: buf } as MessageEvent)
      })
    }
  }, [])

  const { send } = useWebSocket({
    url: wsUrl,
    onOpen: handleOpen,
    onClose: handleClose,
    onMessage: handleMessage,
    binaryType: 'arraybuffer',
    reconnect: false,
  })

  useEffect(() => {
    sendRef.current = send
  }, [send])

  // Forward keyboard input
  useEffect(() => {
    const term = xtermRef.current
    if (!term)
      return
    const disposable = term.onData((data) => {
      if (status === 'connected') {
        const encoder = new TextEncoder()
        const payload = encoder.encode(data)
        const frame = new Uint8Array(1 + payload.length)
        frame[0] = MSG_TERMINAL_DATA
        frame.set(payload, 1)
        send(frame.buffer)
      }
    })
    return () => disposable.dispose()
  }, [send, status])

  // Send resize
  useEffect(() => {
    const term = xtermRef.current
    if (!term || status !== 'connected')
      return
    const disposable = term.onResize(({ cols, rows }) => {
      const payload = JSON.stringify({ cols, rows })
      const encoder = new TextEncoder()
      const encoded = encoder.encode(payload)
      const frame = new Uint8Array(1 + encoded.length)
      frame[0] = MSG_RESIZE
      frame.set(encoded, 1)
      send(frame.buffer)
    })
    return () => disposable.dispose()
  }, [send, status])

  // Window resize -> re-fit
  useEffect(() => {
    if (!isActive || status !== 'connected')
      return
    const handleResize = () => fitAddonRef.current?.fit()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isActive, status])

  function handleHostKeyDecision(accepted: boolean) {
    sendHostKeyResponse(sendRef.current, accepted)
    setHostKeyPrompt(null)
  }

  return (
    <div className="relative w-full h-full" style={{ backgroundColor: getCliTerminalBackground(resolvedTheme) }}>
      <div ref={termDivRef} className="w-full h-full" />
      {hostKeyPrompt != null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
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
                <span className="text-foreground">{hostKeyPrompt.algorithm}</span>
              </div>
              <div>
                <span className="text-muted-foreground mr-2">
                  {t('gateway:terminal.hostKey.key')}
                </span>
                <span className="text-foreground">{hostKeyPrompt.key_base64}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => handleHostKeyDecision(false)}>
                {t('gateway:terminal.hostKey.reject')}
              </Button>
              <Button size="sm" onClick={() => handleHostKeyDecision(true)}>
                {t('gateway:terminal.hostKey.accept')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
