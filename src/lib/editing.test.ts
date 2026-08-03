import { describe, expect, it } from 'vitest'
import {
  continueList,
  indent,
  insertLink,
  outdent,
  toggleWrap,
  type TextSelection,
} from './editing'

/**
 * Builds a TextSelection from a string using `|` for the caret or a `«…»` span
 * for a selection. Guillemets rather than brackets, so the notation does not
 * collide with markdown link and task-list syntax.
 */
function sel(spec: string): TextSelection {
  if (spec.includes('«')) {
    const start = spec.indexOf('«')
    const end = spec.indexOf('»') - 1
    return {
      value: spec.replace('«', '').replace('»', ''),
      selectionStart: start,
      selectionEnd: end,
    }
  }
  const caret = spec.indexOf('|')
  return { value: spec.replace('|', ''), selectionStart: caret, selectionEnd: caret }
}

/** Renders a TextSelection back to the `|` / `«»` notation. */
function show(state: TextSelection): string {
  const { value, selectionStart, selectionEnd } = state
  if (selectionStart === selectionEnd) {
    return `${value.slice(0, selectionStart)}|${value.slice(selectionStart)}`
  }
  return `${value.slice(0, selectionStart)}«${value.slice(selectionStart, selectionEnd)}»${value.slice(selectionEnd)}`
}

describe('toggleWrap', () => {
  it('wraps a selection in bold markers and keeps it selected', () => {
    expect(show(toggleWrap(sel('make «this» bold'), '**'))).toBe('make **«this»** bold')
  })

  it('inserts an empty pair with the caret between the markers', () => {
    expect(show(toggleWrap(sel('a|b'), '**'))).toBe('a**|**b')
  })

  it('unwraps when markers sit just outside the selection', () => {
    expect(show(toggleWrap(sel('make **«this»** plain'), '**'))).toBe('make «this» plain')
  })

  it('unwraps when markers are inside the selection', () => {
    expect(show(toggleWrap(sel('make «**this**» plain'), '**'))).toBe('make «this» plain')
  })

  it('supports italic markers independently of bold', () => {
    expect(show(toggleWrap(sel('«word»'), '*'))).toBe('*«word»*')
  })
})

describe('insertLink', () => {
  it('wraps the selection and selects the url placeholder', () => {
    expect(show(insertLink(sel('see «docs» here')))).toBe('see [docs](«url») here')
  })

  it('works with an empty selection', () => {
    expect(show(insertLink(sel('|')))).toBe('[](«url»)')
  })
})

describe('indent', () => {
  it('inserts two spaces at the caret', () => {
    expect(show(indent(sel('|text')))).toBe('  |text')
  })

  it('indents every line a multi-line selection touches', () => {
    const state = { value: 'one\ntwo\nthree', selectionStart: 0, selectionEnd: 7 }
    expect(indent(state).value).toBe('  one\n  two\nthree')
  })

  it('indents from the start of the line the selection begins on', () => {
    const state = { value: 'alpha\nbeta', selectionStart: 2, selectionEnd: 8 }
    expect(indent(state).value).toBe('  alpha\n  beta')
  })
})

describe('outdent', () => {
  it('removes one indent level at the caret line', () => {
    expect(outdent({ value: '  text', selectionStart: 6, selectionEnd: 6 }).value).toBe('text')
  })

  it('is a no-op on an unindented line', () => {
    expect(outdent({ value: 'text', selectionStart: 4, selectionEnd: 4 }).value).toBe('text')
  })

  it('outdents each line of a selection', () => {
    const state = { value: '  one\n  two', selectionStart: 0, selectionEnd: 11 }
    expect(outdent(state).value).toBe('one\ntwo')
  })

  it('removes a leading tab as one level', () => {
    expect(outdent({ value: '\ttext', selectionStart: 5, selectionEnd: 5 }).value).toBe('text')
  })

  it('never moves the selection before the line start', () => {
    const result = outdent({ value: '  a', selectionStart: 0, selectionEnd: 0 })
    expect(result.selectionStart).toBe(0)
  })

  it('reverses an indent typed mid-line, so Shift+Tab undoes Tab', () => {
    expect(show(outdent(indent(sel('2. second|'))))).toBe('2. second|')
  })

  it('outdents the line when the caret sits in leading indentation', () => {
    expect(show(outdent(sel('  |text')))).toBe('|text')
  })

  it('outdents a nested list item rather than eating text', () => {
    expect(show(outdent(sel('  - nested|')))).toBe('- nested|')
  })

  it('leaves a single prose space alone', () => {
    expect(outdent(sel('word |')).value).toBe('word ')
  })
})

describe('continueList', () => {
  it('continues a bullet list', () => {
    expect(show(continueList(sel('- first|'))!)).toBe('- first\n- |')
  })

  it('preserves the bullet character', () => {
    expect(show(continueList(sel('* item|'))!)).toBe('* item\n* |')
  })

  it('increments an ordered list', () => {
    expect(show(continueList(sel('3. third|'))!)).toBe('3. third\n4. |')
  })

  it('continues a task list with an unchecked box', () => {
    expect(show(continueList(sel('- [x] done|'))!)).toBe('- [x] done\n- [ ] |')
  })

  it('preserves nesting indentation', () => {
    expect(show(continueList(sel('  - nested|'))!)).toBe('  - nested\n  - |')
  })

  it('clears the marker on an empty item to end the list', () => {
    expect(show(continueList(sel('- one\n- |'))!)).toBe('- one\n|')
  })

  it('clears an empty task item', () => {
    expect(show(continueList(sel('- [ ] |'))!)).toBe('|')
  })

  it('returns null outside a list so Enter behaves normally', () => {
    expect(continueList(sel('plain text|'))).toBeNull()
    expect(continueList(sel('# heading|'))).toBeNull()
  })

  it('returns null when text is selected', () => {
    expect(continueList({ value: '- item', selectionStart: 2, selectionEnd: 6 })).toBeNull()
  })

  it('continues a list from the middle of a document', () => {
    const state = sel('- a|\n- b')
    expect(continueList(state)!.value).toBe('- a\n- \n- b')
  })
})
