import { useEffect } from 'react'
import type { ThemePreference } from '../types'

function apply(theme: ThemePreference, systemDark: boolean) {
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
}

/** Keep <html data-theme> in sync with the preference and the OS setting. */
export function useTheme(theme: ThemePreference): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    apply(theme, media.matches)
    const onChange = (event: MediaQueryListEvent) => apply(theme, event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])
}
