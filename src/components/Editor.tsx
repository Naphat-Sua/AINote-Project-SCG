import { useState, type KeyboardEvent } from 'react'
import type { Note, ViewMode } from '../types'
import { countWords, renderMarkdown } from '../lib/markdown'
import { formatRelativeTime } from '../lib/format'

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

export function Editor({ note, viewMode, onViewModeChange, onChange, onTogglePin, onDelete }: EditorProps) {
  const [tagDraft, setTagDraft] = useState('')

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
            className="editor-content"
            placeholder="Write in markdown…"
            value={note.content}
            onChange={(e) => onChange({ content: e.target.value })}
            aria-label="Note content"
            spellCheck
          />
        )}
        {showPreview && (
          <div
            className="markdown-preview"
            // Rendered output is sanitized with DOMPurify in renderMarkdown.
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
          />
        )}
      </div>
    </section>
  )
}
