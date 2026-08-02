import { useEffect, useRef, useState } from 'react'
import type { Note, Settings } from '../types'
import {
  askNotes,
  describeError,
  improveWriting,
  isAbortError,
  suggestTags,
  suggestTitle,
  summarizeNote,
} from '../lib/ai'
import { renderMarkdown } from '../lib/markdown'

type Action = 'summarize' | 'improve' | 'title' | 'tags' | 'ask'

interface AIPanelProps {
  settings: Settings
  note: Note | null
  notes: Note[]
  existingTags: string[]
  onApplyTitle: (title: string) => void
  onAddTags: (tags: string[]) => void
  onReplaceContent: (content: string) => void
  onSelectNote: (id: string) => void
  onOpenSettings: () => void
}

export function AIPanel({
  settings,
  note,
  notes,
  existingTags,
  onApplyTitle,
  onAddTags,
  onReplaceContent,
  onSelectNote,
  onOpenSettings,
}: AIPanelProps) {
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState('')
  const [outputKind, setOutputKind] = useState<'summary' | 'improved' | null>(null)
  const [suggestedTags, setSuggestedTags] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<Note[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Results describe a specific note; clear them when switching notes.
  // (State adjustment during render, per the React docs pattern.)
  const noteId = note?.id ?? null
  const [lastNoteId, setLastNoteId] = useState(noteId)
  if (noteId !== lastNoteId) {
    setLastNoteId(noteId)
    setOutput('')
    setOutputKind(null)
    setSuggestedTags([])
    setError(null)
  }

  useEffect(() => () => abortRef.current?.abort(), [])

  const hasKey = settings.apiKey.length > 0
  const noteReady = note !== null && note.content.trim().length > 0

  const run = async (action: Action, task: (signal: AbortSignal) => Promise<void>) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(action)
    setError(null)
    try {
      await task(controller.signal)
    } catch (err) {
      if (!isAbortError(err)) setError(describeError(err))
    } finally {
      setBusy((current) => (current === action ? null : current))
    }
  }

  const stop = () => {
    abortRef.current?.abort()
    setBusy(null)
  }

  const handleSummarize = () => {
    if (!note) return
    setOutput('')
    setOutputKind('summary')
    void run('summarize', async (signal) => {
      await summarizeNote(settings, note, (delta) => setOutput((prev) => prev + delta), signal)
    })
  }

  const handleImprove = () => {
    if (!note) return
    setOutput('')
    setOutputKind('improved')
    void run('improve', async (signal) => {
      await improveWriting(settings, note, (delta) => setOutput((prev) => prev + delta), signal)
    })
  }

  const handleTitle = () => {
    if (!note) return
    void run('title', async (signal) => {
      const title = await suggestTitle(settings, note, signal)
      if (title) onApplyTitle(title)
    })
  }

  const handleTags = () => {
    if (!note) return
    setSuggestedTags([])
    void run('tags', async (signal) => {
      const tags = await suggestTags(settings, note, existingTags, signal)
      setSuggestedTags(tags.filter((t) => !note.tags.includes(t)))
    })
  }

  const handleAsk = () => {
    const q = question.trim()
    if (!q) return
    setAnswer('')
    setSources([])
    void run('ask', async (signal) => {
      const result = await askNotes(settings, q, notes, (delta) => setAnswer((prev) => prev + delta), signal)
      setSources(result.sources)
    })
  }

  if (!hasKey) {
    return (
      <div className="ai-panel">
        <h2 className="ai-panel-title">✦ AI Assistant</h2>
        <div className="ai-setup-notice">
          <p>
            Connect your Anthropic API key to unlock summaries, tag suggestions, writing
            improvements, and Q&amp;A over your notes.
          </p>
          <p className="ai-setup-fineprint">
            Your key is stored only in this browser and calls go directly to the Anthropic API —
            there is no middleman server.
          </p>
          <button className="btn btn-primary" onClick={onOpenSettings}>
            Add API key
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ai-panel">
      <h2 className="ai-panel-title">✦ AI Assistant</h2>

      <div className="ai-section">
        <h3 className="ai-section-title">This note</h3>
        <div className="ai-actions">
          <button className="btn" disabled={!noteReady || busy !== null} onClick={handleSummarize}>
            {busy === 'summarize' ? 'Summarizing…' : 'Summarize'}
          </button>
          <button className="btn" disabled={!noteReady || busy !== null} onClick={handleImprove}>
            {busy === 'improve' ? 'Improving…' : 'Improve writing'}
          </button>
          <button className="btn" disabled={!noteReady || busy !== null} onClick={handleTitle}>
            {busy === 'title' ? 'Thinking…' : 'Suggest title'}
          </button>
          <button className="btn" disabled={!noteReady || busy !== null} onClick={handleTags}>
            {busy === 'tags' ? 'Thinking…' : 'Suggest tags'}
          </button>
        </div>
        {!noteReady && <p className="ai-hint">Select a note with some content to use these.</p>}

        {suggestedTags.length > 0 && (
          <div className="ai-suggested-tags">
            {suggestedTags.map((tag) => (
              <button
                key={tag}
                className="tag-chip"
                onClick={() => {
                  onAddTags([tag])
                  setSuggestedTags((prev) => prev.filter((t) => t !== tag))
                }}
                title="Add this tag"
              >
                + #{tag}
              </button>
            ))}
            <button className="btn btn-ghost small" onClick={() => { onAddTags(suggestedTags); setSuggestedTags([]) }}>
              Add all
            </button>
          </div>
        )}

        {output && (
          <div className="ai-output">
            <div
              className="markdown-preview compact"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(output) }}
            />
            <div className="ai-output-actions">
              {outputKind === 'improved' && busy === null && (
                <button
                  className="btn btn-primary small"
                  onClick={() => {
                    onReplaceContent(output)
                    setOutput('')
                    setOutputKind(null)
                  }}
                >
                  Replace note content
                </button>
              )}
              {outputKind === 'summary' && busy === null && note && (
                <button
                  className="btn small"
                  onClick={() => {
                    onReplaceContent(`> **Summary**\n>\n${output.trim().split('\n').map((l) => `> ${l}`).join('\n')}\n\n${note.content}`)
                    setOutput('')
                    setOutputKind(null)
                  }}
                >
                  Insert at top of note
                </button>
              )}
              <button className="btn btn-ghost small" onClick={() => { setOutput(''); setOutputKind(null) }}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="ai-section">
        <h3 className="ai-section-title">Ask your notes</h3>
        <div className="ai-ask">
          <textarea
            placeholder="e.g. What did we decide about the Q3 budget?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleAsk()
              }
            }}
            rows={2}
            aria-label="Ask a question about your notes"
          />
          <button
            className="btn btn-primary"
            disabled={busy !== null || question.trim() === ''}
            onClick={handleAsk}
          >
            {busy === 'ask' ? 'Searching…' : 'Ask'}
          </button>
        </div>
        {answer && (
          <div className="ai-output">
            <div
              className="markdown-preview compact"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(answer) }}
            />
            {sources.length > 0 && (
              <div className="ai-sources">
                <span className="ai-sources-label">From:</span>
                {sources.map((s) => (
                  <button key={s.id} className="ai-source-link" onClick={() => onSelectNote(s.id)}>
                    {s.title || 'Untitled'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {busy !== null && (
        <button className="btn btn-ghost small ai-stop" onClick={stop}>
          ■ Stop
        </button>
      )}
      {error && (
        <div className="ai-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
