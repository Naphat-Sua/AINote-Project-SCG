import { describe, expect, it } from 'vitest'
import { highlightSegments } from './highlight'

/** Renders segments with «» around matches, for readable expectations. */
function show(text: string, terms: string[]): string {
  return highlightSegments(text, terms)
    .map((s) => (s.match ? `«${s.text}»` : s.text))
    .join('')
}

describe('highlightSegments', () => {
  it('marks a single match', () => {
    expect(show('the budget review', ['budget'])).toBe('the «budget» review')
  })

  it('is case-insensitive but preserves original casing', () => {
    expect(show('Budget and BUDGET', ['budget'])).toBe('«Budget» and «BUDGET»')
  })

  it('marks every occurrence', () => {
    expect(show('a a a', ['a'])).toBe('«a» «a» «a»')
  })

  it('handles multiple terms', () => {
    expect(show('meeting about budget', ['budget', 'meeting'])).toBe('«meeting» about «budget»')
  })

  it('merges overlapping matches instead of nesting them', () => {
    expect(show('abcd', ['abc', 'bcd'])).toBe('«abcd»')
  })

  it('merges adjacent matches', () => {
    expect(show('abcd', ['ab', 'cd'])).toBe('«abcd»')
  })

  it('strips a leading # so tag queries highlight the tag text', () => {
    expect(show('work items', ['#work'])).toBe('«work» items')
  })

  it('returns one unmatched segment when nothing matches', () => {
    expect(highlightSegments('hello', ['zzz'])).toEqual([{ text: 'hello', match: false }])
  })

  it('returns one unmatched segment when there are no terms', () => {
    expect(highlightSegments('hello', [])).toEqual([{ text: 'hello', match: false }])
  })

  it('ignores empty terms', () => {
    expect(highlightSegments('hello', ['', '#'])).toEqual([{ text: 'hello', match: false }])
  })

  it('returns nothing for empty text', () => {
    expect(highlightSegments('', ['a'])).toEqual([])
  })

  it('reassembles to exactly the original text', () => {
    const text = 'Quarterly budget: meeting notes about the budget.'
    const segments = highlightSegments(text, ['budget', 'meeting'])
    expect(segments.map((s) => s.text).join('')).toBe(text)
  })
})
