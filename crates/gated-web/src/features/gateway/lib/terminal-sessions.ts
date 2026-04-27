import type { IDisposable } from '@xterm/xterm'
import type { ResolvedTheme } from '@/shared/lib/terminal-theme'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTerm } from '@xterm/xterm'
import { useEffect, useMemo, useReducer } from 'react'
import { getCliTerminalBackground, getCliTerminalTheme } from '@/shared/lib/terminal-theme'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
export type TerminalKind = 'ssh' | 'mysql' | 'postgres'

export interface HostKeyPrompt {
  algorithm: string
  key_base64: string
}

const MSG_TERMINAL_DATA = 0x00
const MSG_RESIZE = 0x01
const MSG_HOST_KEY_VERIFY = 0x03

function buildWsUrl(kind: TerminalKind, targetName: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host
  return `${protocol}//${host}/api/${kind}/terminal/${encodeURIComponent(targetName)}`
}

function encodeFrame(msgType: number, payload: Uint8Array): ArrayBuffer {
  const frame = new Uint8Array(1 + payload.length)
  frame[0] = msgType
  frame.set(payload, 1)
  return frame.buffer
}

export class TerminalSession {
  readonly kind: TerminalKind
  readonly targetName: string
  readonly term: XTerm
  readonly fitAddon: FitAddon
  readonly container: HTMLDivElement

  private ws: WebSocket | null = null
  private _status: ConnectionStatus = 'connecting'
  private _hostKeyPrompt: HostKeyPrompt | null = null
  private dataDisposable: IDisposable | null = null
  private resizeDisposable: IDisposable | null = null
  private readonly subscribers = new Set<() => void>()

  constructor(kind: TerminalKind, targetName: string, theme: ResolvedTheme) {
    this.kind = kind
    this.targetName = targetName
    this.container = document.createElement('div')
    this.container.className = 'h-full w-full'
    this.container.style.backgroundColor = getCliTerminalBackground(theme)

    this.term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'monospace',
      theme: getCliTerminalTheme(theme),
    })
    this.fitAddon = new FitAddon()
    this.term.loadAddon(this.fitAddon)
    this.term.open(this.container)

    this.dataDisposable = this.term.onData((data) => {
      if (this._status !== 'connected')
        return
      const payload = new TextEncoder().encode(data)
      this.sendRaw(encodeFrame(MSG_TERMINAL_DATA, payload))
    })

    this.resizeDisposable = this.term.onResize(({ cols, rows }) => {
      if (this._status !== 'connected')
        return
      const payload = new TextEncoder().encode(JSON.stringify({ cols, rows }))
      this.sendRaw(encodeFrame(MSG_RESIZE, payload))
    })

    this.connect()
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get hostKeyPrompt(): HostKeyPrompt | null {
    return this._hostKeyPrompt
  }

  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb)
    return () => {
      this.subscribers.delete(cb)
    }
  }

  private emit() {
    for (const cb of this.subscribers) cb()
  }

  fit() {
    if (this.container.isConnected) {
      try {
        this.fitAddon.fit()
      }
      catch {
        // container may not be laid out yet; ignore
      }
    }
  }

  setTheme(theme: ResolvedTheme) {
    this.container.style.backgroundColor = getCliTerminalBackground(theme)
    this.term.options.theme = getCliTerminalTheme(theme)
  }

  reconnect() {
    if (this.ws != null && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.onclose = null
      this.ws.close()
    }
    this.ws = null
    this.connect()
  }

  respondHostKey(accepted: boolean) {
    const payload = new TextEncoder().encode(JSON.stringify({ accepted }))
    this.sendRaw(encodeFrame(MSG_HOST_KEY_VERIFY, payload))
    this._hostKeyPrompt = null
    this.emit()
  }

  dispose() {
    if (this.ws != null) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.dataDisposable?.dispose()
    this.resizeDisposable?.dispose()
    this.term.dispose()
    this.container.remove()
  }

  private sendRaw(data: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(data)
  }

  private connect() {
    this._status = 'connecting'
    this._hostKeyPrompt = null
    this.emit()

    const ws = new WebSocket(buildWsUrl(this.kind, this.targetName))
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      this._status = 'connected'
      this.term.clear()
      const payload = new TextEncoder().encode(
        JSON.stringify({ cols: this.term.cols, rows: this.term.rows }),
      )
      this.sendRaw(encodeFrame(MSG_RESIZE, payload))
      this.emit()
    }
    ws.onclose = () => {
      this._status = 'disconnected'
      this.term.writeln('\r\n\x1B[31m[disconnected]\x1B[0m')
      this.emit()
    }
    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleBinary(new Uint8Array(event.data))
      }
      else if (event.data instanceof Blob) {
        void event.data.arrayBuffer().then((buf) => {
          this.handleBinary(new Uint8Array(buf))
        })
      }
    }
    this.ws = ws
  }

  private handleBinary(view: Uint8Array) {
    if (view.length === 0)
      return
    const msgType = view[0]
    const payload = view.slice(1)

    if (msgType === MSG_TERMINAL_DATA) {
      this.term.write(new TextDecoder().decode(payload))
      return
    }

    if (msgType === MSG_HOST_KEY_VERIFY) {
      try {
        const text = new TextDecoder().decode(payload)
        const msg = JSON.parse(text) as { algorithm?: string, key_base64?: string }
        if (msg.algorithm != null && msg.key_base64 != null) {
          this._hostKeyPrompt = { algorithm: msg.algorithm, key_base64: msg.key_base64 }
          this.emit()
        }
      }
      catch {
        // ignore parse errors
      }
      return
    }

    try {
      const text = new TextDecoder().decode(payload)
      const msg = JSON.parse(text) as { status?: string, message?: string }
      if (msg.status === 'error' || msg.status === 'closed') {
        this.term.writeln(`\r\n\x1B[33m[${msg.message ?? msg.status}]\x1B[0m`)
      }
      else if (msg.status != null && msg.status !== 'connected') {
        this.term.writeln(`\r\n\x1B[36m[${msg.message ?? msg.status}]\x1B[0m`)
      }
    }
    catch {
      // ignore parse errors
    }
  }
}

const sessionMap = new Map<string, TerminalSession>()

function sessionKey(kind: TerminalKind, targetName: string): string {
  return `${kind}:${targetName}`
}

export function getOrCreateSession(kind: TerminalKind, targetName: string, theme: ResolvedTheme): TerminalSession {
  const key = sessionKey(kind, targetName)
  let session = sessionMap.get(key)
  if (session == null) {
    session = new TerminalSession(kind, targetName, theme)
    sessionMap.set(key, session)
  }
  else {
    session.setTheme(theme)
  }
  return session
}

export function closeSession(kind: TerminalKind, targetName: string): void {
  const key = sessionKey(kind, targetName)
  const session = sessionMap.get(key)
  if (session == null)
    return
  session.dispose()
  sessionMap.delete(key)
}

export function useTerminalSession(kind: TerminalKind, targetName: string, theme: ResolvedTheme): TerminalSession {
  const session = useMemo(() => getOrCreateSession(kind, targetName, theme), [kind, targetName, theme])
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    session.setTheme(theme)
  }, [session, theme])
  useEffect(() => session.subscribe(forceUpdate), [session])
  return session
}
