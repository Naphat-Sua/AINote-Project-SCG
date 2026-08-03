import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note, ViewMode } from './types'
import { useNotes } from './hooks/useNotes'
import { useSettings } from './hooks/useSettings'
import { useTheme } from './hooks/useTheme'
import { collectTags } from './lib/search'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { AIPanel } from './components/AIPanel'
import { SettingsModal } from './components/SettingsModal'
import { Toast } from './components/Toast'

export default function App() {
  const {
    notes,
    persistenceError,
    addNote,
    updateNote,
    deleteNote,
    restoreNote,
    togglePin,
    replaceAll,
    mergeImported,
  } = useNotes()
  const { settings, updateSettings } = useSettings()
  useTheme(settings.theme)

  const [selectedId, setSelectedId] = useState<string | null>(() => notes[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(true)
  const [undoDelete, setUndoDelete] = useState<{ note: Note; index: number } | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  const selected = useMemo(
    () => notes.find((n) => n.id === selectedId) ?? null,
    [notes, selectedId],
  )
  const allTags = useMemo(() => collectTags(notes).map((t) => t.tag), [notes])

  const handleNewNote = useCallback(() => {
    const note = addNote()
    setSelectedId(note.id)
    setQuery('')
    setActiveTag(null)
    setViewMode('edit')
  }, [addNote])

  // Deleting is instant and offers an undo, rather than gating on a blocking
  // confirm dialog: less friction, and actually recoverable if it was a slip.
  const handleDelete = useCallback(() => {
    if (!selected) return
    const index = notes.findIndex((n) => n.id === selected.id)
    const remaining = notes.filter((n) => n.id !== selected.id)
    deleteNote(selected.id)
    setSelectedId(remaining[0]?.id ?? null)
    setUndoDelete({ note: selected, index })
  }, [selected, notes, deleteNote])

  const handleUndoDelete = useCallback(() => {
    if (!undoDelete) return
    restoreNote(undoDelete.note, undoDelete.index)
    setSelectedId(undoDelete.note.id)
    setUndoDelete(null)
  }, [undoDelete, restoreNote])

  const dismissUndo = useCallback(() => setUndoDelete(null), [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // The editor claims some of these (Cmd+K inserts a link) and marks the
      // event handled; never steal a shortcut a focused control already used.
      if (event.defaultPrevented) return
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      } else if (meta && event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        handleNewNote()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleNewNote])

  return (
    <div className={`app ${aiOpen ? 'ai-open' : ''}`}>
      <Sidebar
        notes={notes}
        selectedId={selectedId}
        query={query}
        activeTag={activeTag}
        searchRef={searchRef}
        onQueryChange={setQuery}
        onTagChange={setActiveTag}
        onSelect={setSelectedId}
        onNewNote={handleNewNote}
        onOpenSettings={openSettings}
      />

      <main className="main">
        {persistenceError && (
          <div className="persistence-banner" role="alert">
            ⚠ {persistenceError}
          </div>
        )}
        {selected ? (
          <Editor
            // Remount per note so per-note editor state (an in-progress tag
            // draft, scroll position) never leaks across a selection change.
            key={selected.id}
            note={selected}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onChange={(patch) => updateNote(selected.id, patch)}
            onTogglePin={() => togglePin(selected.id)}
            onDelete={handleDelete}
          />
        ) : (
          <div className="empty-state">
            <p className="empty-state-icon" aria-hidden="true">📝</p>
            <h2>No note selected</h2>
            <p>Create a note to start writing — markdown supported.</p>
            <button className="btn btn-primary" onClick={handleNewNote}>
              + New note
            </button>
          </div>
        )}
      </main>

      <button
        className="ai-toggle"
        onClick={() => setAiOpen((v) => !v)}
        title={aiOpen ? 'Hide AI assistant' : 'Show AI assistant'}
        aria-expanded={aiOpen}
      >
        {aiOpen ? '✦ ▸' : '◂ ✦'}
      </button>

      {aiOpen && (
        <AIPanel
          settings={settings}
          note={selected}
          notes={notes}
          existingTags={allTags}
          onApplyTitle={(title) => selected && updateNote(selected.id, { title })}
          onAddTags={(tags) =>
            selected &&
            updateNote(selected.id, { tags: [...new Set([...selected.tags, ...tags])] })
          }
          onReplaceContent={(content) => selected && updateNote(selected.id, { content })}
          onSelectNote={setSelectedId}
          onOpenSettings={openSettings}
        />
      )}

      {undoDelete && (
        <Toast
          message={`Deleted “${undoDelete.note.title || 'Untitled'}”`}
          actionLabel="Undo"
          onAction={handleUndoDelete}
          onDismiss={dismissUndo}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          notes={notes}
          onUpdate={updateSettings}
          onImport={mergeImported}
          onDeleteAll={() => {
            replaceAll([])
            setSelectedId(null)
          }}
          onClose={closeSettings}
        />
      )}
    </div>
  )
}
