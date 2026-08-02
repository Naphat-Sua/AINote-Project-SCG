import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { Settings } from '../types'
import { AVAILABLE_MODELS } from '../lib/ai'
import { exportNotes, importNotes } from '../lib/storage'
import type { Note } from '../types'

interface SettingsModalProps {
  settings: Settings
  notes: Note[]
  onUpdate: (patch: Partial<Settings>) => void
  onImport: (notes: Note[]) => number
  onDeleteAll: () => void
  onClose: () => void
}

export function SettingsModal({ settings, notes, onUpdate, onImport, onDeleteAll, onClose }: SettingsModalProps) {
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes the dialog, and focus moves into it on open so keyboard
  // and screen-reader users are not left behind on the page underneath.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleExport = () => {
    const blob = new Blob([exportNotes(notes)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ainote-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const added = onImport(importNotes(await file.text()))
      setMessage(`Imported ${added} new note${added === 1 ? '' : 's'}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  const handleDeleteAll = () => {
    if (window.confirm('Delete ALL notes? This cannot be undone. Consider exporting first.')) {
      onDeleteAll()
      setMessage('All notes deleted.')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="modal-section">
          <h3>AI (Anthropic API)</h3>
          <label className="field">
            <span className="field-label">API key</span>
            <div className="field-row">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-ant-…"
                value={settings.apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value.trim() })}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="btn btn-ghost" onClick={() => setShowKey((v) => !v)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <span className="field-help">
              Stored only in this browser (localStorage) and sent directly to the Anthropic API.
              Anyone with access to this browser profile can read it — don't use a production key
              on a shared machine. Get a key at{' '}
              <a href="https://platform.claude.com/" target="_blank" rel="noreferrer">
                platform.claude.com
              </a>
              .
            </span>
          </label>
          <label className="field">
            <span className="field-label">Model</span>
            <select value={settings.model} onChange={(e) => onUpdate({ model: e.target.value })}>
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-section">
          <h3>Appearance</h3>
          <label className="field">
            <span className="field-label">Theme</span>
            <select
              value={settings.theme}
              onChange={(e) => onUpdate({ theme: e.target.value as Settings['theme'] })}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <div className="modal-section">
          <h3>Your data</h3>
          <p className="field-help">
            Notes live in this browser's localStorage. Export regularly if they matter.
          </p>
          <div className="field-row">
            <button className="btn" onClick={handleExport} disabled={notes.length === 0}>
              Export notes (JSON)
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Import notes
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
            <button className="btn danger-outline" onClick={handleDeleteAll} disabled={notes.length === 0}>
              Delete all notes
            </button>
          </div>
          {message && <p className="field-message">{message}</p>}
        </div>
      </div>
    </div>
  )
}
