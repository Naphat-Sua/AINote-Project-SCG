import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

beforeEach(() => {
  localStorage.clear()
})

describe('App', () => {
  it('shows the empty state on first launch', () => {
    render(<App />)
    expect(screen.getByText('No note selected')).toBeInTheDocument()
    expect(screen.getByText(/0 notes/)).toBeInTheDocument()
  })

  it('creates a note and edits its title', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    const title = screen.getByLabelText('Note title')
    await user.type(title, 'Standup notes')

    expect(screen.getByText(/1 note$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Standup notes/ })).toBeInTheDocument()
  })

  it('filters notes with search', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    await user.type(screen.getByLabelText('Note title'), 'Grocery list')

    const search = screen.getByLabelText('Search notes')
    await user.type(search, 'grocery')
    expect(screen.getByRole('button', { name: /Grocery list/ })).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'zzz-no-match')
    expect(screen.getByText('Nothing matches.')).toBeInTheDocument()
  })

  it('prompts for an API key in the AI panel until one is set', () => {
    render(<App />)
    expect(screen.getByText(/Connect your Anthropic API key/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add API key' })).toBeInTheDocument()
  })

  it('opens settings from the AI panel', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'Add API key' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })

  it('closes settings with the Escape key', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Add API key' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument()
  })

  it('restores a deleted note when Undo is used', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    await user.type(screen.getByLabelText('Note title'), 'Delete me')

    await user.click(screen.getByTitle('Delete note'))
    expect(screen.queryByRole('button', { name: /Delete me/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Deleted/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: /Delete me/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Note title')).toHaveValue('Delete me')
  })

  it('dismisses the undo toast without restoring', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    await user.type(screen.getByLabelText('Note title'), 'Gone for good')
    await user.click(screen.getByTitle('Delete note'))

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText(/Deleted/)).not.toBeInTheDocument()
    expect(screen.getByText(/0 notes/)).toBeInTheDocument()
  })

  it('highlights search matches in the note list', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    await user.type(screen.getByLabelText('Note title'), 'Quarterly budget')
    await user.type(screen.getByLabelText('Search notes'), 'budget')

    const marks = document.querySelectorAll('.note-card mark')
    expect(marks.length).toBeGreaterThan(0)
    expect([...marks].some((m) => m.textContent === 'budget')).toBe(true)
  })

  it('applies bold with Ctrl+B instead of focusing search on Ctrl+K', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    const content = screen.getByLabelText('Note content') as HTMLTextAreaElement
    await user.click(content)
    await user.type(content, 'word')

    // Select "word", then bold it.
    content.setSelectionRange(0, 4)
    await user.keyboard('{Control>}b{/Control}')
    expect(content).toHaveValue('**word**')

    // Bold leaves the word selected so formatting chains; Ctrl+K then links
    // that selection rather than jumping to search. This also proves the
    // caret is restored across the controlled-value rewrite.
    await user.keyboard('{Control>}k{/Control}')
    expect(content).toHaveValue('**[word](url)**')
    expect(content).toHaveFocus()
  })

  it('continues a markdown list on Enter', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    const content = screen.getByLabelText('Note content')
    await user.click(content)
    await user.type(content, '- first{Enter}second')

    expect(content).toHaveValue('- first\n- second')
  })

  it('indents with Tab inside the editor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    const content = screen.getByLabelText('Note content')
    await user.click(content)
    await user.type(content, 'text')
    await user.keyboard('{Tab}')

    expect(content).toHaveValue('text  ')
    expect(content).toHaveFocus()
  })

  it('still focuses search with Ctrl+K outside the editor', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByLabelText('Search notes')).toHaveFocus()
  })

  it('does not carry an unfinished tag draft across notes', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    await user.type(screen.getByLabelText('Note title'), 'Note A')
    await user.type(screen.getByLabelText('Add a tag'), 'half-typed')

    // Switching notes must not leave the draft sitting in the new note's input.
    await user.click(screen.getByRole('button', { name: /\+ New$/i }))
    expect(screen.getByLabelText('Add a tag')).toHaveValue('')
  })
})
