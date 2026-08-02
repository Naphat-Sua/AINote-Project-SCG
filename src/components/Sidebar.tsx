import { useMemo, type RefObject } from 'react'
import type { Note } from '../types'
import { collectTags, searchNotes } from '../lib/search'
import { excerpt } from '../lib/markdown'
import { formatRelativeTime } from '../lib/format'

interface SidebarProps {
  notes: Note[]
  selectedId: string | null
  query: string
  activeTag: string | null
  searchRef: RefObject<HTMLInputElement | null>
  onQueryChange: (query: string) => void
  onTagChange: (tag: string | null) => void
  onSelect: (id: string) => void
  onNewNote: () => void
  onOpenSettings: () => void
}

export function Sidebar({
  notes,
  selectedId,
  query,
  activeTag,
  searchRef,
  onQueryChange,
  onTagChange,
  onSelect,
  onNewNote,
  onOpenSettings,
}: SidebarProps) {
  const tags = useMemo(() => collectTags(notes), [notes])

  const visible = useMemo(() => {
    const base = activeTag ? notes.filter((n) => n.tags.includes(activeTag)) : notes
    return searchNotes(base, query)
  }, [notes, query, activeTag])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="app-title">
          <span aria-hidden="true">📝</span> AINote
        </h1>
        <button className="btn btn-primary" onClick={onNewNote} title="New note (Ctrl+Alt+N)">
          + New
        </button>
      </div>

      <div className="sidebar-search">
        <input
          ref={searchRef}
          type="search"
          placeholder="Search notes…  (Ctrl+K)"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Search notes"
        />
      </div>

      {tags.length > 0 && (
        <div className="tag-filter" role="listbox" aria-label="Filter by tag">
          <button
            className={`tag-chip ${activeTag === null ? 'active' : ''}`}
            onClick={() => onTagChange(null)}
          >
            All
          </button>
          {tags.map(({ tag, count }) => (
            <button
              key={tag}
              className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
              onClick={() => onTagChange(activeTag === tag ? null : tag)}
              title={`${count} note${count === 1 ? '' : 's'}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <nav className="note-list" aria-label="Notes">
        {visible.length === 0 && (
          <p className="note-list-empty">
            {notes.length === 0 ? 'No notes yet. Create one!' : 'Nothing matches.'}
          </p>
        )}
        {visible.map((note) => (
          <button
            key={note.id}
            className={`note-card ${note.id === selectedId ? 'selected' : ''}`}
            onClick={() => onSelect(note.id)}
          >
            <div className="note-card-title">
              {note.pinned && <span title="Pinned" aria-label="Pinned">📌 </span>}
              {note.title || 'Untitled'}
            </div>
            {note.content && <div className="note-card-excerpt">{excerpt(note.content)}</div>}
            <div className="note-card-meta">
              <span>{formatRelativeTime(note.updatedAt)}</span>
              {note.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="note-card-tag">#{tag}</span>
              ))}
            </div>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="note-count">
          {notes.length} note{notes.length === 1 ? '' : 's'}
        </span>
        <button className="btn btn-ghost" onClick={onOpenSettings}>
          ⚙︎ Settings
        </button>
      </div>
    </aside>
  )
}
