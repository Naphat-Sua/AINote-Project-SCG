import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './format'

const NOW = new Date('2026-08-02T12:00:00Z').getTime()

describe('formatRelativeTime', () => {
  it('says "just now" within a minute', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('just now')
  })

  it('reports minutes and hours', () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe('5m ago')
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3h ago')
  })

  it('reports days within a week', () => {
    expect(formatRelativeTime(NOW - 2 * 86_400_000, NOW)).toBe('2d ago')
  })

  it('falls back to a date beyond a week', () => {
    const result = formatRelativeTime(NOW - 30 * 86_400_000, NOW)
    expect(result).toMatch(/Jul/)
  })

  it('includes the year for other years', () => {
    const result = formatRelativeTime(new Date('2024-03-05T00:00:00Z').getTime(), NOW)
    expect(result).toMatch(/2024/)
  })
})
