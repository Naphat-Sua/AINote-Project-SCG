import { beforeEach, describe, expect, it } from 'vitest'
import {
  createNote,
  exportNotes,
  importNotes,
  loadNotes,
  loadSettings,
  normalizeNote,
  saveNotes,
  saveSettings,
  DEFAULT_SETTINGS,
} from './storage'

beforeEach(() => {
  localStorage.clear()
})

describe('notes persistence', () => {
  it('round-trips notes through localStorage', () => {
    const notes = [
      createNote({ title: 'First', content: 'Hello', tags: ['a'] }),
      createNote({ title: 'Second', content: 'World', pinned: true }),
    ]
    saveNotes(notes)
    expect(loadNotes()).toEqual(notes)
  })

  it('returns an empty list when storage is empty', () => {
    expect(loadNotes()).toEqual([])
  })

  it('returns an empty list when storage is corrupted', () => {
    localStorage.setItem('ainote.notes.v1', '{not json')
    expect(loadNotes()).toEqual([])
    localStorage.setItem('ainote.notes.v1', '"a string"')
    expect(loadNotes()).toEqual([])
  })

  it('drops malformed entries and dedupes ids on load', () => {
    const good = createNote({ title: 'Keep me', content: 'x' })
    localStorage.setItem(
      'ainote.notes.v1',
      JSON.stringify([good, good, 42, null, { random: 'junk' }]),
    )
    const loaded = loadNotes()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].title).toBe('Keep me')
  })
})

describe('normalizeNote', () => {
  it('backfills missing fields', () => {
    const note = normalizeNote({ content: 'just content' })
    expect(note).not.toBeNull()
    expect(note!.title).toBe('')
    expect(note!.tags).toEqual([])
    expect(note!.pinned).toBe(false)
    expect(note!.id).toBeTruthy()
    expect(note!.createdAt).toBeGreaterThan(0)
  })

  it('filters non-string tags', () => {
    const note = normalizeNote({ content: 'x', tags: ['ok', 3, null, ''] })
    expect(note!.tags).toEqual(['ok'])
  })

  it('rejects values that are not note-shaped', () => {
    expect(normalizeNote(null)).toBeNull()
    expect(normalizeNote('hi')).toBeNull()
    expect(normalizeNote({ pinned: true })).toBeNull()
  })
})

describe('export / import', () => {
  it('round-trips through the export format', () => {
    const notes = [createNote({ title: 'A', content: 'aaa', tags: ['t'] })]
    const imported = importNotes(exportNotes(notes))
    expect(imported).toEqual(notes)
  })

  it('accepts a bare array of notes', () => {
    const notes = [createNote({ title: 'Bare', content: 'x' })]
    expect(importNotes(JSON.stringify(notes))).toEqual(notes)
  })

  it('rejects invalid JSON with a readable message', () => {
    expect(() => importNotes('nope{')).toThrow(/not valid JSON/)
  })

  it('rejects JSON that is not an export', () => {
    expect(() => importNotes('{"foo": 1}')).toThrow(/does not look like/)
  })

  it('rejects files with no usable notes', () => {
    expect(() => importNotes('{"app":"ainote","version":1,"notes":[{"bogus":true}]}')).toThrow(
      /No valid notes/,
    )
  })
})

describe('settings persistence', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips settings', () => {
    saveSettings({ apiKey: 'sk-test', model: 'claude-opus-5', theme: 'dark' })
    expect(loadSettings()).toEqual({ apiKey: 'sk-test', model: 'claude-opus-5', theme: 'dark' })
  })

  it('sanitizes unknown theme values', () => {
    localStorage.setItem('ainote.settings.v1', JSON.stringify({ theme: 'hotdog' }))
    expect(loadSettings().theme).toBe('system')
  })
})
