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

/**
 * A plain-text preview of markdown content for list rows: syntax stripped,
 * whitespace collapsed, truncated with an ellipsis.
 */
export function excerpt(source: string, maxLength = 120): string {
  const text = source
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
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trimEnd()}…`
}

/** Word count for the status bar. */
export function countWords(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean)
  return words.length
}
