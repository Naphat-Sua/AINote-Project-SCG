import { useCallback, useEffect, useState } from 'react'
import type { Settings } from '../types'
import { loadSettings, saveSettings } from '../lib/storage'

export interface SettingsApi {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

export function useSettings(): SettingsApi {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return { settings, updateSettings }
}
