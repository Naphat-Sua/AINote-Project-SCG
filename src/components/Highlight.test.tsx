import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Highlight } from './Highlight'

describe('Highlight', () => {
  it('wraps matches in <mark> and leaves the rest plain', () => {
    const { container } = render(<Highlight text="the budget review" terms={['budget']} />)
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('budget')
    expect(container).toHaveTextContent('the budget review')
  })

  it('renders plain text when there are no terms', () => {
    const { container } = render(<Highlight text="nothing to mark" terms={[]} />)
    expect(container.querySelectorAll('mark')).toHaveLength(0)
    expect(container).toHaveTextContent('nothing to mark')
  })

  it('renders markup in the source text as literal characters', () => {
    // Segments are rendered as elements, so this can never become real markup.
    render(<Highlight text={'<img src=x onerror=alert(1)>'} terms={['img']} />)
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })
})
