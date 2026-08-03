import { describe, expect, it } from 'vitest'
import { countWords, excerpt, renderMarkdown } from './markdown'

describe('renderMarkdown', () => {
  it('renders basic markdown', () => {
    const html = renderMarkdown('# Title\n\nSome **bold** text and `code`.')
    expect(html).toContain('<h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
  })

  it('renders GFM task lists and tables', () => {
    const html = renderMarkdown('- [x] done\n- [ ] todo\n\n| a | b |\n| - | - |\n| 1 | 2 |')
    expect(html).toContain('<input')
    expect(html).toContain('<table>')
  })

  it('strips script tags', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> world')
    expect(html).not.toContain('<script')
    expect(html).toContain('hello')
  })

  it('strips inline event handlers and javascript: URLs', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)"> [link](javascript:alert(1))')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('javascript:')
  })
})

describe('excerpt', () => {
  it('strips markdown syntax', () => {
    const text = excerpt('# Heading\n\n- **item one**\n- [link](https://x.dev)\n> quoted')
    expect(text).toBe('Heading item one link quoted')
  })

  it('drops fenced code blocks', () => {
    expect(excerpt('before\n```js\nconst x = 1\n```\nafter')).toBe('before after')
  })

  it('truncates long content with an ellipsis', () => {
    const text = excerpt('word '.repeat(100), 40)
    expect(text.length).toBeLessThanOrEqual(41)
    expect(text.endsWith('…')).toBe(true)
  })

  it('returns empty for empty content', () => {
    expect(excerpt('')).toBe('')
  })

  it('slides the window to a match that falls outside the default excerpt', () => {
    const text = `${'filler '.repeat(40)}needle tail`
    const snippet = excerpt(text, 60, ['needle'])
    expect(snippet).toContain('needle')
    expect(snippet.startsWith('…')).toBe(true)
  })

  it('keeps the window at the start when the match is already visible', () => {
    const text = `needle ${'filler '.repeat(40)}`
    const snippet = excerpt(text, 60, ['needle'])
    expect(snippet.startsWith('needle')).toBe(true)
  })

  it('ignores terms that do not appear', () => {
    const text = 'alpha '.repeat(40)
    expect(excerpt(text, 40, ['zzz']).startsWith('alpha')).toBe(true)
  })

  it('strips a leading # from tag terms when locating the window', () => {
    const text = `${'filler '.repeat(40)}budget tail`
    expect(excerpt(text, 60, ['#budget'])).toContain('budget')
  })
})

describe('countWords', () => {
  it('counts words across lines', () => {
    expect(countWords('one two\nthree')).toBe(3)
  })

  it('returns 0 for whitespace', () => {
    expect(countWords('   \n ')).toBe(0)
  })
})
