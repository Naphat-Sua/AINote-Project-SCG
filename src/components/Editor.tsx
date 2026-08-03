import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Note, ViewMode } from '../types'
import { countWords, renderMarkdown } from '../lib/markdown'
import { formatRelativeTime } from '../lib/format'
import {
  continueList,
  indent,
  insertLink,
  outdent,
  toggleWrap,
  type TextSelection,
} from '../lib/editing'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

interface EditorProps {
  note: Note
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onChange: (patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => void
  onTogglePin: () => void
  onDelete: () => void
}

const VIEW_MODES: { id: ViewMode; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'split', label: 'Split' },
  { id: 'preview', label: 'Preview' },
]

/** Keeps markdown parsing off the keystroke path without feeling laggy. */
const PREVIEW_DEBOUNCE_MS = 120

export function Editor({ note, viewMode, onViewModeChange, onChange, onTogglePin, onDelete }: EditorProps) {
  const [tagDraft, setTagDraft] = useState('')
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelection = useRef<[number, number] | null>(null)

  // The whole `dangerouslySetInnerHTML` object is memoized, not just the HTML
  // string: React re-applies innerHTML when that prop object changes identity,
  // so a fresh literal each render rebuilds the entire preview subtree on every
  // keystroke even when the markup is byte-identical.
  const debouncedContent = useDebouncedValue(note.content, PREVIEW_DEBOUNCE_MS)
  const previewMarkup = useMemo(
    () => ({ __html: renderMarkdown(debouncedContent) }),
    [debouncedContent],
  )

  // A shortcut rewrites the whole value, so the caret has to be restored after
  // React commits the controlled update.
  useEffect(() => {
    const selection = pendingSelection.current
    if (!selection) return
    pendingSelection.current = null
    contentRef.current?.setSelectionRange(selection[0], selection[1])
  })

  const applyEdit = (next: TextSelection | null): boolean => {
    if (!next) return false
    pendingSelection.current = [next.selectionStart, next.selectionEnd]
    onChange({ content: next.value })
    return true
  }

  const onContentKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget
    const state: TextSelection = {
      value: el.value,
      selectionStart: el.selectionStart,
      selectionEnd: el.selectionEnd,
    }
    const meta = event.metaKey || event.ctrlKey

    if (meta && !event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault()
          applyEdit(toggleWrap(state, '**'))
          return
        case 'i':
          event.preventDefault()
          applyEdit(toggleWrap(state, '*'))
          return
        // Inside the editor Cmd+K means "link". preventDefault also tells the
        // app-level shortcut handler to leave this event alone.
        case 'k':
          event.preventDefault()
          applyEdit(insertLink(state))
          return
      }
    }

    if (event.key === 'Tab') {
      event.preventDefault()
      applyEdit(event.shiftKey ? outdent(state) : indent(state))
      return
    }

    if (event.key === 'Enter' && !meta && !event.shiftKey) {
      if (applyEdit(continueList(state))) event.preventDefault()
      return
    }

    // Tab is captured for indentation, so Escape is the keyboard route out.
    if (event.key === 'Escape') el.blur()
  }

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
    setTagDraft('')
    if (!tag || note.tags.includes(tag)) return
    onChange({ tags: [...note.tags, tag] })
  }

  const onTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && tagDraft === '' && note.tags.length > 0) {
      onChange({ tags: note.tags.slice(0, -1) })
    }
  }

  const removeTag = (tag: string) => {
    onChange({ tags: note.tags.filter((t) => t !== tag) })
  }

  const showEditor = viewMode !== 'preview'
  const showPreview = viewMode !== 'edit'

  return (
    <section className="editor" aria-label="Note editor">
      <div className="editor-toolbar">
        <div className="view-switch" role="tablist" aria-label="View mode">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.id}
              role="tab"
              aria-selected={viewMode === mode.id}
              className={`view-tab ${viewMode === mode.id ? 'active' : ''}`}
              onClick={() => onViewModeChange(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <div className="editor-toolbar-right">
          <span className="editor-meta">
            {countWords(note.content)} words · saved {formatRelativeTime(note.updatedAt)}
          </span>
          <button
            className={`btn btn-ghost ${note.pinned ? 'pinned' : ''}`}
            onClick={onTogglePin}
            title={note.pinned ? 'Unpin note' : 'Pin note'}
          >
            📌
          </button>
          <button className="btn btn-ghost danger" onClick={onDelete} title="Delete note">
            🗑
          </button>
        </div>
      </div>

      <input
        className="editor-title"
        placeholder="Untitled"
        value={note.title}
        onChange={(e) => onChange({ title: e.target.value })}
        aria-label="Note title"
      />

      <div className="editor-tags">
        {note.tags.map((tag) => (
          <span key={tag} className="tag-chip static">
            #{tag}
            <button
              className="tag-remove"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder={note.tags.length === 0 ? 'Add tags…' : '+'}
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={onTagKeyDown}
          onBlur={addTag}
          aria-label="Add a tag"
        />
      </div>

      <div className={`editor-body mode-${viewMode}`}>
        {showEditor && (
          <textarea
            ref={contentRef}
            className="editor-content"
            placeholder="Write in markdown…  Ctrl/Cmd+B bold · Ctrl/Cmd+I italic · Ctrl/Cmd+K link · Tab indent"
            value={note.content}
            onChange={(e) => onChange({ content: e.target.value })}
            onKeyDown={onContentKeyDown}
            aria-label="Note content"
            aria-describedby="editor-shortcut-help"
            spellCheck
          />
        )}
        {showPreview && (
          <div
            className="markdown-preview"
            // Sanitized with DOMPurify in renderMarkdown.
            dangerouslySetInnerHTML={previewMarkup}
          />
        )}
      </div>

      <p id="editor-shortcut-help" className="visually-hidden">
        Formatting shortcuts: Control or Command plus B for bold, I for italic, K for link.
        Tab indents and Shift Tab outdents. Enter continues a markdown list. Press Escape to
        move focus out of the editor.
      </p>
    </section>
  )
}
