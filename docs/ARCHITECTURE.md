# AINote — Architecture

## Overview

AINote is a single-page React application with no backend. All state lives in the browser; the only network dependency is the Anthropic API, called directly from the client when the user invokes an AI action.

```
src/
├── main.tsx              entry point
├── App.tsx               layout, selection, keyboard shortcuts, wiring
├── types.ts              Note, Settings, ViewMode
├── lib/                  pure, unit-tested domain logic
│   ├── storage.ts        persistence, validation, import/export
│   ├── search.ts         scoring, ranking, tag collection, context selection
│   ├── markdown.ts       rendering (marked + DOMPurify), excerpts, word count
│   ├── format.ts         relative timestamps
│   ├── editing.ts        markdown editing text transforms (pure)
│   ├── highlight.ts      search-match segmentation (pure)
│   └── ai.ts             Claude API service (streaming, parsing, errors)
├── hooks/
│   ├── useNotes.ts       note state + debounced persistence
│   ├── useSettings.ts    settings state + persistence
│   ├── useTheme.ts       <html data-theme> sync incl. OS preference
│   └── useDebouncedValue.ts  collapses rapid changes (preview rendering)
└── components/
    ├── Sidebar.tsx       search, tag filter, note list
    ├── Editor.tsx        title, tags, content, view modes
    ├── AIPanel.tsx       AI actions + ask-your-notes
    ├── SettingsModal.tsx key/model/theme/data management
    ├── Highlight.tsx     search-match rendering
    ├── Toast.tsx         transient notices (undo delete)
    └── ErrorBoundary.tsx render-crash recovery
```

The split is deliberate: **`lib/` is framework-free and fully unit-tested**; hooks adapt lib to React state; components stay thin.

## Data model

```ts
interface Note {
  id: string          // uuid
  title: string
  content: string     // markdown
  tags: string[]      // lowercase, hyphenated
  pinned: boolean
  createdAt: number   // epoch ms
  updatedAt: number   // epoch ms
}
```

### Persistence

- Keys are versioned (`ainote.notes.v1`, `ainote.settings.v1`) so future schema changes can migrate explicitly.
- Every load path validates and normalizes (`normalizeNote`): malformed entries are dropped, missing fields backfilled, duplicate ids deduped. Corrupted storage degrades to an empty list instead of crashing.
- Writes are debounced (250 ms) and flushed on `pagehide` and unmount, so fast typing doesn't serialize the store per keystroke but nothing is lost on tab close.
- Import accepts the app's export envelope **or** a bare JSON array of notes, merges by id (existing notes win), and reports how many were added.

## Search

`searchNotes` tokenizes the query and scores each note per term:

| Signal                        | Weight |
| ----------------------------- | ------ |
| exact title match             | 120    |
| title prefix / substring      | 60/40  |
| exact tag match (`#` aware)   | 50     |
| tag substring                 | 20     |
| content hits (diminishing)    | 10 + 3·min(hits−1, 5) |

Terms combine with AND semantics for search (every term must match), and ties break by pinned status then recency. The same scorer powers **context selection for Q&A** (`selectRelevantNotes`) with OR semantics and a top-k cut, falling back to the most recent notes when nothing matches.

## AI integration (`lib/ai.ts`)

- Uses the official `@anthropic-ai/sdk` with `dangerouslyAllowBrowser: true`. This is the intended architecture for a BYO-key client-only app: the key belongs to the user and is configured by the user, and there is no server that could hold it instead.
- Default model `claude-opus-5`; user-selectable (Sonnet 5, Haiku 4.5). No `thinking`/`effort` overrides are sent so every listed model accepts the same request shape.
- All long-form outputs use `client.messages.stream()` with an `AbortController` per action; the panel exposes a Stop button. `stop_reason === "refusal"` is surfaced as a friendly error.
- Token discipline: single-note actions truncate at 24 K chars; Q&A packs relevance-ranked notes into a 60 K-char budget (always at least one note).
- Tag suggestions request a JSON array but parse defensively (`parseTagsResponse` handles fenced blocks, embedded arrays, comma lists) and normalize to the app's tag format.
- Errors map to actionable messages via the SDK's typed error classes (`AuthenticationError` → "check your key", `RateLimitError` → "wait a moment", …). User-initiated aborts are silent.

### Prompt design

- **Summarize / improve / title / tags** operate on one note with tight system prompts and "no preamble" instructions; *improve* explicitly preserves meaning, voice, and language, and its result is previewed and only applied on user confirmation.
- **Ask your notes** wraps each selected note in a `<note title="…">` block and instructs the model to answer *only* from those blocks and cite titles in bold — grounding over fluency.

## Rendering safety

All markdown → HTML goes through `renderMarkdown`, which is `marked` (GFM, breaks) piped into `DOMPurify.sanitize`. Tests assert that `<script>`, inline event handlers, and `javascript:` URLs are stripped. AI output is rendered through the same path, so a hostile or confused model response cannot execute code.

## Editor internals

Keyboard behaviour lives in `lib/editing.ts` as pure `TextSelection → TextSelection`
functions (`toggleWrap`, `insertLink`, `indent`, `outdent`, `continueList`), so
caret arithmetic is unit-tested without a DOM. `Editor` translates key events into
those calls, stashes the returned selection in a ref, and reapplies it in an effect
after React commits the controlled value — otherwise every shortcut would drop the
caret at the end of the note.

Two behaviours are worth knowing:

- **`Ctrl/Cmd+K` is overloaded.** In the editor it inserts a link; elsewhere it
  focuses search. The editor calls `preventDefault()`, and the app-level shortcut
  handler bails on `event.defaultPrevented`, so neither needs to know about the
  other.
- **`Shift+Tab` is context-sensitive.** Directly after an indent typed mid-line it
  removes that indent (so it reverses `Tab`); otherwise it strips leading
  indentation from the touched lines, which is what outdenting a list item needs.
  Since `Tab` is captured for indentation, `Escape` blurs the textarea to satisfy
  WCAG 2.1.2 (no keyboard trap).

### Preview rendering cost

Markdown parsing and sanitizing is kept off the keystroke path two ways, and the
second one turned out to matter far more than the first:

1. The content feeding the preview is debounced (120 ms), so `renderMarkdown` runs
   once per pause rather than once per character.
2. **The entire `dangerouslySetInnerHTML` object is memoized**, not just the HTML
   string. React re-applies `innerHTML` when that prop object changes identity, so
   a fresh `{ __html }` literal each render rebuilt the whole preview subtree on
   every keystroke even when the markup was byte-identical.

Measured in Chromium on an 11 KB note in split view, typing 40 characters:
41 preview subtree rebuilds before, 1 after. Debouncing alone did not change that
number — only memoizing the prop object did.

## Reliability

Four failure modes get explicit handling, because for a notes app the worst
outcome is losing writing:

- **Storage rejects a write** (quota exceeded, private browsing). `saveNotes`
  returns a boolean rather than swallowing the error; `useNotes` surfaces it as
  a banner telling the user their changes are memory-only and to export. Silent
  failure here would look identical to working software right up until the tab
  closes.
- **A render throws.** `ErrorBoundary` catches it and shows a recovery screen
  instead of a white page, noting that persisted notes are unaffected.
- **Corrupt or foreign data on load.** Every read path validates and normalizes;
  unparseable storage degrades to an empty list rather than a crash loop.
- **An accidental delete.** Deletion is immediate but reversible for 9 seconds via
  an undo toast, restoring the note at its original index. A blocking `confirm()`
  was worse on both axes — more friction, and still unrecoverable once accepted.
  Delete-*all* in Settings does still confirm, since undo does not cover it.

### A note on `mergeImported`

The import count is computed *before* `setNotes`, from a ref mirroring the last
committed state — not assigned inside the state updater. React may defer or
replay an updater, so a value written inside one is not readable by the caller;
doing that made the UI always report "Imported 0 new notes." There is a
regression test for it in `useNotes.test.ts`.

## Testing strategy

| Layer      | What is covered                                                        |
| ---------- | ---------------------------------------------------------------------- |
| storage       | round-trips, corruption recovery, normalization, import validation     |
| search        | ranking order, AND/OR semantics, tag matching, fallbacks, limits       |
| markdown      | GFM rendering, XSS stripping, excerpt/word-count edge cases            |
| ai            | tag-response parsing variants, context budgeting, error mapping        |
| format        | relative-time buckets                                                  |
| useNotes      | add/update/delete/pin/restore, import counting and id-collision handling |
| editing       | wrap/unwrap, link, indent, outdent, list continuation, caret positions  |
| highlight     | match runs, overlap merging, exact text reassembly                     |
| useDebounced… | initial passthrough, delayed update, collapsing rapid changes           |
| ErrorBoundary | passthrough when healthy, recovery screen on a render throw            |
| Highlight     | renders <mark> elements, treats markup in note text as literal         |
| App (RTL)     | first-launch state, create/edit/search flows, AI key gating, settings, Escape-to-close, per-note editor isolation, undo delete, shortcut routing |

The AI network layer itself is intentionally untested at the unit level (it is a thin pass-through to the SDK); its pure helpers — which contain the logic that can actually break — are extracted and tested.

## Ideas for future work

- IndexedDB backend for large note sets (storage interface is already isolated)
- Embedding-based semantic search for Q&A context selection
- Note linking (`[[wiki-style]]`) and backlinks
- Optional end-to-end-encrypted sync
