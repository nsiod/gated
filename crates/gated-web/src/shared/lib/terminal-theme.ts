export type ResolvedTheme = 'dark' | 'light'

const CLI_TERMINAL_DARK_THEME = {
  background: '#1a1a1a',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
  black: '#2d2d2d',
  red: '#e06c75',
  green: '#98c379',
  yellow: '#e5c07b',
  blue: '#61afef',
  magenta: '#c678dd',
  cyan: '#56b6c2',
  white: '#d4d4d4',
  brightBlack: '#5c6370',
  brightRed: '#ff7b72',
  brightGreen: '#b5cea8',
  brightYellow: '#f2cc60',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#7fdbca',
  brightWhite: '#ffffff',
}

const CLI_TERMINAL_LIGHT_THEME = {
  background: '#f8fafc',
  foreground: '#0f172a',
  cursor: '#2563eb',
  selectionBackground: '#bfdbfe',
  black: '#475569',
  red: '#b91c1c',
  green: '#166534',
  yellow: '#a16207',
  blue: '#1d4ed8',
  magenta: '#a21caf',
  cyan: '#0f766e',
  white: '#e2e8f0',
  brightBlack: '#64748b',
  brightRed: '#dc2626',
  brightGreen: '#15803d',
  brightYellow: '#ca8a04',
  brightBlue: '#2563eb',
  brightMagenta: '#c026d3',
  brightCyan: '#0d9488',
  brightWhite: '#ffffff',
}

export function getCliTerminalTheme(theme: ResolvedTheme) {
  return theme === 'dark' ? CLI_TERMINAL_DARK_THEME : CLI_TERMINAL_LIGHT_THEME
}

export function getCliTerminalBackground(theme: ResolvedTheme): string {
  return getCliTerminalTheme(theme).background
}
