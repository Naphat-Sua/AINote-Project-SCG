import type { Note } from '../types'

/** Split a query (or note text) into comparable lowercase terms. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}#]+/u)
    .filter((t) => t.length > 0)
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let index = haystack.indexOf(needle)
  while (index !== -1) {
    count += 1
    index = haystack.indexOf(needle, index + needle.length)
  }
  return count
}

/**
 * Score how well a note matches a single search term.
 * Title and tag hits dominate; content hits accumulate with
 * diminishing returns. Returns 0 when the term is absent.
 */
export function scoreNoteForTerm(note: Note, term: string): number {
  const title = note.title.toLowerCase()
  const content = note.content.toLowerCase()
  const tags = note.tags.map((t) => t.toLowerCase())

  let score = 0
  if (title === term) score += 120
  else if (title.startsWith(term)) score += 60
  else if (title.includes(term)) score += 40

  if (tags.includes(term) || tags.includes(term.replace(/^#/, ''))) score += 50
  else if (tags.some((t) => t.includes(term))) score += 20

  const hits = countOccurrences(content, term)
  if (hits > 0) score += 10 + Math.min(hits - 1, 5) * 3

  return score
}

/**
 * Full-text search over notes. Every term must match somewhere in the note
 * (AND semantics). Results are ordered by relevance, then pinned status,
 * then recency. An empty query returns all notes, pinned first, newest first.
 */
export function searchNotes(notes: Note[], query: string): Note[] {
  const terms = tokenize(query)
  if (terms.length === 0) return sortNotes(notes)

  const scored: { note: Note; score: number }[] = []
  for (const note of notes) {
    let total = 0
    let matchedAll = true
    for (const term of terms) {
      const s = scoreNoteForTerm(note, term)
      if (s === 0) {
        matchedAll = false
        break
      }
      total += s
    }
    if (matchedAll) scored.push({ note, score: total })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.note.pinned !== b.note.pinned) return a.note.pinned ? -1 : 1
    return b.note.updatedAt - a.note.updatedAt
  })
  return scored.map((s) => s.note)
}

/** Default ordering when there is no query: pinned first, newest first. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return b.updatedAt - a.updatedAt
  })
}

/**
 * Pick the notes most relevant to a natural-language question (OR semantics —
 * a note matching any term is a candidate). Used to build the context window
 * for "ask your notes". Falls back to the most recent notes when nothing
 * matches, so the model always has something to work with.
 */
export function selectRelevantNotes(notes: Note[], question: string, limit = 8): Note[] {
  const terms = tokenize(question)
  const scored = notes
    .map((note) => ({
      note,
      score: terms.reduce((sum, term) => sum + scoreNoteForTerm(note, term), 0),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)

  const picked = scored.slice(0, limit).map((s) => s.note)
  if (picked.length > 0) return picked
  return sortNotes(notes).slice(0, Math.min(limit, 4))
}

/** All tags in use, with counts, most used first. */
export function collectTags(notes: Note[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    for (const tag of note.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
