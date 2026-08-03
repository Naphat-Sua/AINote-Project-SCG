import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.use({ gfm: true, breaks: true })

/**
 * Render markdown to sanitized HTML. All output passes through DOMPurify,
 * so pasted or AI-generated markdown cannot inject scripts or event handlers.
 */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false })
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
}

/** Strip markdown syntax down to readable plain text. */
function toPlainText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, '') // headings
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '') // task list markers
    .replace(/^\s*[-*+]\s+/gm, '') // list markers
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // emphasis
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Where to start the excerpt window. When a search term only appears past the
 * default window, slide the window to it so the row shows the text that
 * actually matched instead of an unrelated opening line.
 */
function windowStart(text: string, terms: string[], maxLength: number): number {
  const lower = text.toLowerCase()
  let earliest = -1
  for (const term of terms) {
    const needle = term.replace(/^#/, '').toLowerCase()
    if (!needle) continue
    const at = lower.indexOf(needle)
    if (at !== -1 && (earliest === -1 || at < earliest)) earliest = at
  }
  // No match, or it is already visible in the default window.
  if (earliest === -1 || earliest < maxLength) return 0
  const lead = 24
  return Math.min(Math.max(0, earliest - lead), Math.max(0, text.length - maxLength))
}

/**
 * A plain-text preview of markdown content for list rows: syntax stripped,
 * whitespace collapsed, and clipped with ellipses. Pass search terms to centre
 * the snippet on the first match.
 */
export function excerpt(source: string, maxLength = 120, terms: string[] = []): string {
  const text = toPlainText(source)
  if (text.length <= maxLength) return text

  const start = windowStart(text, terms, maxLength)
  const end = start + maxLength
  const slice = text.slice(start, end).trimEnd()
  return `${start > 0 ? '…' : ''}${slice}${end < text.length ? '…' : ''}`
}

/** Word count for the status bar. */
export function countWords(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean)
  return words.length
}
