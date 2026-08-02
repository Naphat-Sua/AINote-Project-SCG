import type { Note, Settings } from '../types'

const NOTES_KEY = 'ainote.notes.v1'
const SETTINGS_KEY = 'ainote.settings.v1'

export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'claude-opus-5',
  theme: 'system',
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createNote(partial: Partial<Note> = {}): Note {
  const now = Date.now()
  return {
    id: generateId(),
    title: '',
    content: '',
    tags: [],
    pinned: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Coerce unknown data into a valid Note, or return null if it is not
 * note-shaped at all. Missing optional fields are backfilled so older
 * exports and hand-edited files import cleanly.
 */
export function normalizeNote(value: unknown): Note | null {
  if (!isRecord(value)) return null
  if (typeof value.content !== 'string' && typeof value.title !== 'string') return null
  const now = Date.now()
  return {
    id: typeof value.id === 'string' && value.id ? value.id : generateId(),
    title: typeof value.title === 'string' ? value.title : '',
    content: typeof value.content === 'string' ? value.content : '',
    tags: Array.isArray(value.tags)
      ? value.tags.filter((t): t is string => typeof t === 'string' && t.length > 0)
      : [],
    pinned: value.pinned === true,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return dedupeById(parsed.map(normalizeNote).filter((n): n is Note => n !== null))
  } catch {
    return []
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  } catch {
    // Storage may be full or unavailable (private browsing); the app keeps
    // working from memory, so swallow rather than crash mid-keystroke.
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...DEFAULT_SETTINGS }
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' && parsed.model ? parsed.model : DEFAULT_SETTINGS.model,
      theme:
        parsed.theme === 'light' || parsed.theme === 'dark' || parsed.theme === 'system'
          ? parsed.theme
          : 'system',
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Same rationale as saveNotes.
  }
}

interface ExportFile {
  app: 'ainote'
  version: 1
  exportedAt: string
  notes: Note[]
}

export function exportNotes(notes: Note[]): string {
  const file: ExportFile = {
    app: 'ainote',
    version: 1,
    exportedAt: new Date().toISOString(),
    notes,
  }
  return JSON.stringify(file, null, 2)
}

/**
 * Parse an export file (or a bare array of notes) into valid notes.
 * Throws with a human-readable message on malformed input.
 */
export function importNotes(json: string): Note[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const list: unknown = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.notes)
      ? parsed.notes
      : null
  if (!Array.isArray(list)) {
    throw new Error('That file does not look like an AINote export.')
  }
  const notes = dedupeById(list.map(normalizeNote).filter((n): n is Note => n !== null))
  if (notes.length === 0) {
    throw new Error('No valid notes were found in that file.')
  }
  return notes
}

function dedupeById(notes: Note[]): Note[] {
  const seen = new Set<string>()
  const result: Note[] = []
  for (const note of notes) {
    if (seen.has(note.id)) continue
    seen.add(note.id)
    result.push(note)
  }
  return result
}
