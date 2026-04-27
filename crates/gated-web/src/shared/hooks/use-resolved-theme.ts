import type { ResolvedTheme } from '@/shared/lib/terminal-theme'
import { useSyncExternalStore } from 'react'
import { useTheme } from '@/shared/hooks/use-theme'

function resolveTheme(theme: 'dark' | 'light' | 'system'): ResolvedTheme {
  if (theme !== 'system')
    return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useResolvedTheme(): ResolvedTheme {
  const { theme } = useTheme()

  return useSyncExternalStore(
    (onStoreChange) => {
      if (theme !== 'system')
        return () => {}

      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => resolveTheme(theme),
    () => resolveTheme(theme),
  )
}
