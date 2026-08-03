export interface Segment {
  text: string
  match: boolean
}

/**
 * Split text into matched and unmatched runs for the given search terms.
 *
 * Returning segments rather than an HTML string keeps highlighting XSS-safe:
 * callers render `<mark>` elements around note text instead of interpolating
 * it into markup.
 */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  if (!text) return []

  const needles = [
    ...new Set(
      terms
        .map((term) => term.replace(/^#/, '').toLowerCase())
        .filter((term) => term.length > 0),
    ),
  ]
  if (needles.length === 0) return [{ text, match: false }]

  const haystack = text.toLowerCase()
  const ranges: { start: number; end: number }[] = []
  for (const needle of needles) {
    let index = haystack.indexOf(needle)
    while (index !== -1) {
      ranges.push({ start: index, end: index + needle.length })
      index = haystack.indexOf(needle, index + needle.length)
    }
  }
  if (ranges.length === 0) return [{ text, match: false }]

  ranges.sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = [ranges[0]]
  for (const range of ranges.slice(1)) {
    const last = merged[merged.length - 1]
    if (range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push(range)
  }

  const segments: Segment[] = []
  let cursor = 0
  for (const { start, end } of merged) {
    if (start > cursor) segments.push({ text: text.slice(cursor, start), match: false })
    segments.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false })
  return segments
}
