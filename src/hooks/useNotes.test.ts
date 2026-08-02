import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useNotes } from './useNotes'
import { createNote } from '../lib/storage'

beforeEach(() => {
  localStorage.clear()
})

describe('useNotes', () => {
  it('starts empty and adds notes newest-first', () => {
    const { result } = renderHook(() => useNotes())
    expect(result.current.notes).toEqual([])

    act(() => {
      result.current.addNote({ title: 'First' })
    })
    act(() => {
      result.current.addNote({ title: 'Second' })
    })

    expect(result.current.notes.map((n) => n.title)).toEqual(['Second', 'First'])
  })

  it('updates a note and bumps updatedAt', () => {
    const { result } = renderHook(() => useNotes())
    let id = ''
    act(() => {
      id = result.current.addNote({ title: 'Draft', updatedAt: 0 }).id
    })

    act(() => {
      result.current.updateNote(id, { title: 'Final' })
    })

    const note = result.current.notes.find((n) => n.id === id)!
    expect(note.title).toBe('Final')
    expect(note.updatedAt).toBeGreaterThan(0)
  })

  it('deletes and pins notes', () => {
    const { result } = renderHook(() => useNotes())
    let id = ''
    act(() => {
      id = result.current.addNote({ title: 'Temp' }).id
    })

    act(() => {
      result.current.togglePin(id)
    })
    expect(result.current.notes[0].pinned).toBe(true)

    act(() => {
      result.current.deleteNote(id)
    })
    expect(result.current.notes).toEqual([])
  })

  describe('mergeImported', () => {
    it('reports the number of notes actually added', () => {
      const { result } = renderHook(() => useNotes())
      act(() => {
        result.current.addNote({ id: 'shared', title: 'Existing' })
      })

      // One id collides with an existing note, one is new.
      let added = -1
      act(() => {
        added = result.current.mergeImported([
          createNote({ id: 'shared', title: 'Duplicate' }),
          createNote({ id: 'fresh', title: 'Imported' }),
        ])
      })

      expect(added).toBe(1)
      expect(result.current.notes).toHaveLength(2)
      expect(result.current.notes.map((n) => n.id).sort()).toEqual(['fresh', 'shared'])
    })

    it('keeps the existing note when an id collides', () => {
      const { result } = renderHook(() => useNotes())
      act(() => {
        result.current.addNote({ id: 'shared', title: 'Existing' })
      })

      act(() => {
        result.current.mergeImported([createNote({ id: 'shared', title: 'Incoming' })])
      })

      expect(result.current.notes).toHaveLength(1)
      expect(result.current.notes[0].title).toBe('Existing')
    })

    it('returns 0 when everything is already present', () => {
      const { result } = renderHook(() => useNotes())
      act(() => {
        result.current.addNote({ id: 'a' })
      })

      let added = -1
      act(() => {
        added = result.current.mergeImported([createNote({ id: 'a' })])
      })

      expect(added).toBe(0)
    })
  })

  it('replaceAll clears every note', () => {
    const { result } = renderHook(() => useNotes())
    act(() => {
      result.current.addNote({ title: 'One' })
    })

    act(() => {
      result.current.replaceAll([])
    })

    expect(result.current.notes).toEqual([])
  })

  it('reports no persistence error while storage works', () => {
    const { result } = renderHook(() => useNotes())
    expect(result.current.persistenceError).toBeNull()
  })
})
