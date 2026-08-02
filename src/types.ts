/** A single markdown note. */
export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  /** Unix epoch milliseconds. */
  createdAt: number
  /** Unix epoch milliseconds. */
  updatedAt: number
}

export type ThemePreference = 'light' | 'dark' | 'system'

/** User settings, persisted locally. The API key never leaves the browser. */
export interface Settings {
  apiKey: string
  model: string
  theme: ThemePreference
}

export type ViewMode = 'edit' | 'split' | 'preview'
