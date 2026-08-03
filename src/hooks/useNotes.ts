import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note } from '../types'
import { createNote, loadNotes, saveNotes } from '../lib/storage'

const SAVE_DEBOUNCE_MS = 250

export const PERSISTENCE_ERROR =
  'Could not save to this browser’s storage — recent changes exist only in memory. ' +
  'Export your notes from Settings to avoid losing them.'

export interface NotesApi {
  notes: Note[]
  /** Set when a write to localStorage failed (quota, private browsing). */
  persistenceError: string | null
  addNote: (partial?: Partial<Note>) => Note
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void
  deleteNote: (id: string) => void
  /** Re-insert a deleted note at its original position (undo). */
  restoreNote: (note: Note, index: number) => void
  togglePin: (id: string) => void
  replaceAll: (notes: Note[]) => void
  /** Adds notes whose ids are not already present. Returns how many were added. */
  mergeImported: (imported: Note[]) => number
}

/**
 * Note state backed by localStorage. Writes are debounced so fast typing
 * doesn't serialize the whole store on every keystroke; the latest state
 * is flushed on unmount and page hide.
 */
export function useNotes(): NotesApi {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [persistenceError, setPersistenceError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors the last rendered notes so deferred work (the debounced save) and
  // event handlers can read current state without stale-closure bugs.
  const latest = useRef(notes)

  useEffect(() => {
    latest.current = notes
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setPersistenceError(saveNotes(latest.current) ? null : PERSISTENCE_ERROR)
    }, SAVE_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [notes])

  useEffect(() => {
    const flush = () => saveNotes(latest.current)
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  const addNote = useCallback((partial?: Partial<Note>): Note => {
    const note = createNote(partial)
    setNotes((prev) => [note, ...prev])
    return note
  }, [])

  const updateNote = useCallback(
    (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)),
      )
    },
    [],
  )

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const restoreNote = useCallback((note: Note, index: number) => {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev
      const next = [...prev]
      next.splice(Math.max(0, Math.min(index, next.length)), 0, note)
      return next
    })
  }, [])

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
    )
  }, [])

  const replaceAll = useCallback((next: Note[]) => {
    setNotes(next)
  }, [])

  const mergeImported = useCallback((imported: Note[]): number => {
    // The count is derived here rather than inside the state updater: React
    // may defer or replay an updater, so a value assigned in one is not
    // readable by the caller. Reading the ref is safe in an event handler,
    // where the latest render has already committed.
    const existing = new Set(latest.current.map((n) => n.id))
    const fresh = imported.filter((n) => !existing.has(n.id))
    if (fresh.length > 0) {
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id))
        return [...fresh.filter((n) => !seen.has(n.id)), ...prev]
      })
    }
    return fresh.length
  }, [])

  return {
    notes,
    persistenceError,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    togglePin,
    replaceAll,
    mergeImported,
  }
}
