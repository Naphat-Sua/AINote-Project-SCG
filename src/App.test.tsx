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
})
