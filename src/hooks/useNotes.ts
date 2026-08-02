import { useCallback, useEffect, useRef, useState } from 'react'
import type { Note } from '../types'
import { createNote, loadNotes, saveNotes } from '../lib/storage'

const SAVE_DEBOUNCE_MS = 250

export interface NotesApi {
  notes: Note[]
  addNote: (partial?: Partial<Note>) => Note
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void
  deleteNote: (id: string) => void
  togglePin: (id: string) => void
  replaceAll: (notes: Note[]) => void
  mergeImported: (imported: Note[]) => number
}

/**
 * Note state backed by localStorage. Writes are debounced so fast typing
 * doesn't serialize the whole store on every keystroke; the latest state
 * is flushed on unmount and page hide.
 */
export function useNotes(): NotesApi {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(notes)

  useEffect(() => {
    latest.current = notes
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => saveNotes(latest.current), SAVE_DEBOUNCE_MS)
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

  const togglePin = useCallback((id: string) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
    )
  }, [])

  const replaceAll = useCallback((next: Note[]) => {
    setNotes(next)
  }, [])

  /** Merge imported notes; existing ids win. Returns how many were added. */
  const mergeImported = useCallback((imported: Note[]): number => {
    let added = 0
    setNotes((prev) => {
      const existing = new Set(prev.map((n) => n.id))
      const fresh = imported.filter((n) => !existing.has(n.id))
      added = fresh.length
      return [...fresh, ...prev]
    })
    return added
  }, [])

  return { notes, addNote, updateNote, deleteNote, togglePin, replaceAll, mergeImported }
}
