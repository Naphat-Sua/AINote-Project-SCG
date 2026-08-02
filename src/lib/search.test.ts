import { describe, expect, it } from 'vitest'
import { collectTags, searchNotes, selectRelevantNotes, sortNotes } from './search'
import { createNote } from './storage'
import type { Note } from '../types'

function note(overrides: Partial<Note>): Note {
  return createNote(overrides)
}

const meeting = note({
  title: 'Team meeting notes',
  content: 'Discussed the roadmap and budget for Q3.',
  tags: ['work', 'meeting'],
  updatedAt: 3000,
})
const groceries = note({
  title: 'Groceries',
  content: 'milk, eggs, coffee beans',
  tags: ['personal'],
  updatedAt: 2000,
})
const budget = note({
  title: 'Q3 budget draft',
  content: 'The budget increases marketing spend. Budget review on Friday.',
  tags: ['work', 'finance'],
  updatedAt: 1000,
})
const all = [meeting, groceries, budget]

describe('searchNotes', () => {
  it('returns everything for an empty query, pinned first then newest', () => {
    const pinned = note({ title: 'Old but pinned', pinned: true, updatedAt: 1 })
    const result = searchNotes([...all, pinned], '')
    expect(result[0]).toBe(pinned)
    expect(result[1]).toBe(meeting)
  })

  it('ranks title matches above content matches', () => {
    const result = searchNotes(all, 'budget')
    expect(result[0]).toBe(budget)
    expect(result).toContain(meeting)
    expect(result).not.toContain(groceries)
  })

  it('applies AND semantics across terms', () => {
    expect(searchNotes(all, 'budget roadmap')).toEqual([meeting])
    expect(searchNotes(all, 'budget unicorn')).toEqual([])
  })

  it('matches tags, including with a # prefix', () => {
    expect(searchNotes(all, 'finance')).toEqual([budget])
    expect(searchNotes(all, '#finance')).toEqual([budget])
  })

  it('is case-insensitive', () => {
    expect(searchNotes(all, 'GROCERIES')).toEqual([groceries])
  })
})

describe('sortNotes', () => {
  it('does not mutate the input', () => {
    const input = [budget, meeting]
    sortNotes(input)
    expect(input[0]).toBe(budget)
  })
})

describe('selectRelevantNotes', () => {
  it('selects notes matching any term, best first', () => {
    const picked = selectRelevantNotes(all, 'what is the budget?')
    expect(picked[0]).toBe(budget)
    expect(picked).toContain(meeting)
  })

  it('falls back to recent notes when nothing matches', () => {
    const picked = selectRelevantNotes(all, 'xylophone zebra')
    expect(picked.length).toBeGreaterThan(0)
    expect(picked[0]).toBe(meeting)
  })

  it('respects the limit', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      note({ title: `budget ${i}`, content: 'budget' }),
    )
    expect(selectRelevantNotes(many, 'budget', 5)).toHaveLength(5)
  })
})

describe('collectTags', () => {
  it('counts and orders tags by frequency', () => {
    expect(collectTags(all)).toEqual([
      { tag: 'work', count: 2 },
      { tag: 'finance', count: 1 },
      { tag: 'meeting', count: 1 },
      { tag: 'personal', count: 1 },
    ])
  })
})
