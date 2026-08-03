/**
 * Pure text transforms behind the editor's keyboard shortcuts. Each takes the
 * textarea's value plus selection and returns the next value and selection, so
 * the behaviour is unit-testable without a DOM.
 */

export interface TextSelection {
  value: string
  selectionStart: number
  selectionEnd: number
}

export const INDENT = '  '

/** `- `, `* `, `+ `, `1. `, optionally followed by a `[ ]` task box. */
const LIST_PATTERN = /^(\s*)([-*+]|\d+\.)(\s+\[[ xX]\])?(\s+)/

/**
 * Wrap the selection in a marker (`**`, `*`, …), or unwrap it when the marker
 * is already there. With an empty selection this inserts the pair and leaves
 * the caret between them.
 */
export function toggleWrap(state: TextSelection, marker: string): TextSelection {
  const { value, selectionStart, selectionEnd } = state
  const selected = value.slice(selectionStart, selectionEnd)
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)

  // Markers sit just outside the selection — unwrap them.
  if (before.endsWith(marker) && after.startsWith(marker)) {
    return {
      value: before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selectionStart: selectionStart - marker.length,
      selectionEnd: selectionEnd - marker.length,
    }
  }

  // Markers are inside the selection — unwrap them.
  if (
    selected.length >= marker.length * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(marker.length, -marker.length)
    return {
      value: before + inner + after,
      selectionStart,
      selectionEnd: selectionStart + inner.length,
    }
  }

  return {
    value: `${before}${marker}${selected}${marker}${after}`,
    selectionStart: selectionStart + marker.length,
    selectionEnd: selectionEnd + marker.length,
  }
}

/**
 * Turn the selection into a markdown link, leaving the `url` placeholder
 * selected so it can be typed straight over.
 */
export function insertLink(state: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = state
  const selected = value.slice(selectionStart, selectionEnd)
  const before = value.slice(0, selectionStart)
  const after = value.slice(selectionEnd)
  const placeholder = 'url'
  // `[` + selected + `](` puts the placeholder 3 characters past the label.
  const urlStart = selectionStart + selected.length + 3
  return {
    value: `${before}[${selected}](${placeholder})${after}`,
    selectionStart: urlStart,
    selectionEnd: urlStart + placeholder.length,
  }
}

function lineStartOf(value: string, index: number): number {
  return value.lastIndexOf('\n', index - 1) + 1
}

/** Indent the caret position, or every line the selection touches. */
export function indent(state: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = state

  if (value.slice(selectionStart, selectionEnd).includes('\n')) {
    const start = lineStartOf(value, selectionStart)
    const block = value.slice(start, selectionEnd)
    const indented = block
      .split('\n')
      .map((line) => INDENT + line)
      .join('\n')
    return {
      value: value.slice(0, start) + indented + value.slice(selectionEnd),
      selectionStart: selectionStart + INDENT.length,
      selectionEnd: selectionEnd + (indented.length - block.length),
    }
  }

  const caret = selectionStart + INDENT.length
  return {
    value: value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd),
    selectionStart: caret,
    selectionEnd: caret,
  }
}

/**
 * Remove one indent level. With a collapsed caret sitting straight after an
 * indent typed mid-line, that indent is removed — so Shift+Tab reverses a Tab.
 * Otherwise leading indentation is stripped from every line touched, which is
 * what outdenting a list item needs.
 */
export function outdent(state: TextSelection): TextSelection {
  const { value, selectionStart, selectionEnd } = state

  if (selectionStart === selectionEnd) {
    const before = value.slice(0, selectionStart)
    const unit = before.endsWith(INDENT) ? INDENT : before.endsWith('\t') ? '\t' : null
    const caretLineStart = lineStartOf(value, selectionStart)
    const cut = selectionStart - (unit?.length ?? 0)
    // Only when real content precedes it on this line; a caret inside leading
    // indentation belongs to the line-based path below.
    if (unit && cut >= caretLineStart && /\S/.test(value.slice(caretLineStart, cut))) {
      return {
        value: value.slice(0, cut) + value.slice(selectionStart),
        selectionStart: cut,
        selectionEnd: cut,
      }
    }
  }

  const start = lineStartOf(value, selectionStart)
  const end = Math.max(selectionStart, selectionEnd)
  const block = value.slice(start, end)

  let removedBeforeCaret = 0
  let removedTotal = 0
  const outdented = block
    .split('\n')
    .map((line, i) => {
      const match = /^( {1,2}|\t)/.exec(line)
      if (!match) return line
      if (i === 0) removedBeforeCaret = match[0].length
      removedTotal += match[0].length
      return line.slice(match[0].length)
    })
    .join('\n')

  return {
    value: value.slice(0, start) + outdented + value.slice(end),
    selectionStart: Math.max(start, selectionStart - removedBeforeCaret),
    selectionEnd: Math.max(start, selectionEnd - removedTotal),
  }
}

/**
 * Enter inside a list: continue it on the next line, incrementing ordered
 * markers. On an empty item, clear the marker instead (the usual way to end a
 * list). Returns null when the caret is not in a list, so the caller can let
 * Enter behave normally.
 */
export function continueList(state: TextSelection): TextSelection | null {
  const { value, selectionStart, selectionEnd } = state
  if (selectionStart !== selectionEnd) return null

  const start = lineStartOf(value, selectionStart)
  const line = value.slice(start, selectionStart)
  const match = LIST_PATTERN.exec(line)
  if (!match) return null

  const [marker, leading, bullet, task, gap] = match

  // Nothing typed after the marker — drop it and end the list.
  if (line.length === marker.length) {
    return {
      value: value.slice(0, start) + value.slice(selectionStart),
      selectionStart: start,
      selectionEnd: start,
    }
  }

  const nextBullet = /^\d+\./.test(bullet) ? `${Number.parseInt(bullet, 10) + 1}.` : bullet
  const insertion = `\n${leading}${nextBullet}${task ? ' [ ]' : ''}${gap}`
  const caret = selectionStart + insertion.length
  return {
    value: value.slice(0, selectionStart) + insertion + value.slice(selectionStart),
    selectionStart: caret,
    selectionEnd: caret,
  }
}
