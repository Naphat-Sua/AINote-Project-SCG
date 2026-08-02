import { describe, expect, it } from 'vitest'
import { buildNotesContext, describeError, parseTagsResponse, truncate } from './ai'
import { createNote } from './storage'

describe('parseTagsResponse', () => {
  it('parses a bare JSON array', () => {
    expect(parseTagsResponse('["alpha","beta"]')).toEqual(['alpha', 'beta'])
  })

  it('parses a fenced JSON block', () => {
    expect(parseTagsResponse('```json\n["alpha","beta"]\n```')).toEqual(['alpha', 'beta'])
  })

  it('parses an object with a tags field', () => {
    expect(parseTagsResponse('{"tags":["x","y"]}')).toEqual(['x', 'y'])
  })

  it('recovers an array embedded in prose', () => {
    expect(parseTagsResponse('Here you go: ["one","two"] — enjoy!')).toEqual(['one', 'two'])
  })

  it('falls back to comma-separated text', () => {
    expect(parseTagsResponse('meetings, project X, budget')).toEqual([
      'meetings',
      'project-x',
      'budget',
    ])
  })

  it('normalizes, dedupes, and caps tags', () => {
    const raw = JSON.stringify(['#Work', 'work', 'A B', 'c', 'd', 'e', 'f', 'g'])
    const tags = parseTagsResponse(raw)
    expect(tags).toContain('work')
    expect(tags).toContain('a-b')
    expect(tags.filter((t) => t === 'work')).toHaveLength(1)
    expect(tags.length).toBeLessThanOrEqual(6)
  })

  it('drops empty and oversized tags', () => {
    expect(parseTagsResponse(JSON.stringify(['', '   ', 'x'.repeat(50), 'ok']))).toEqual(['ok'])
  })
})

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('hello', 100)).toBe('hello')
  })

  it('cuts long text and marks the cut', () => {
    const result = truncate('a'.repeat(50), 10)
    expect(result.startsWith('a'.repeat(10))).toBe(true)
    expect(result).toContain('[truncated]')
  })
})

describe('buildNotesContext', () => {
  it('wraps each note in a titled block', () => {
    const notes = [
      createNote({ title: 'Alpha', content: 'aaa', tags: ['t1'] }),
      createNote({ title: '', content: 'bbb' }),
    ]
    const context = buildNotesContext(notes)
    expect(context).toContain('<note title="Alpha"')
    expect(context).toContain('<note title="(untitled)"')
    expect(context).toContain('aaa')
    expect(context).toContain('</note>')
  })

  it('stops adding notes once the budget is spent, but always includes one', () => {
    const notes = [
      createNote({ title: 'Big', content: 'x'.repeat(500) }),
      createNote({ title: 'Second', content: 'y'.repeat(500) }),
    ]
    const context = buildNotesContext(notes, 600)
    expect(context).toContain('Big')
    expect(context).not.toContain('Second')
  })
})

describe('describeError', () => {
  it('passes through plain Error messages', () => {
    expect(describeError(new Error('boom'))).toBe('boom')
  })

  it('handles non-Error values', () => {
    expect(describeError('weird')).toBe('Something went wrong.')
  })
})
