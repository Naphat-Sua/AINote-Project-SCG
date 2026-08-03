import { useMemo } from 'react'
import { highlightSegments } from '../lib/highlight'

interface HighlightProps {
  text: string
  terms: string[]
}

/**
 * Renders text with search matches wrapped in <mark>. Segments come back as
 * data and are rendered as elements, so note content is never interpolated
 * into markup.
 */
export function Highlight({ text, terms }: HighlightProps) {
  const segments = useMemo(() => highlightSegments(text, terms), [text, terms])

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index}>{segment.text}</mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}
