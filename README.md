# 📝 AINote

**AI-powered markdown notes — local-first, with Claude built in.**

AINote is a fast, keyboard-friendly note-taking app that runs entirely in your browser. Your notes live in local storage, and an optional Anthropic API key unlocks AI features that work *on* your notes: summarization, tag suggestions, title generation, writing improvement, and natural-language Q&A across everything you've written.

No backend. No account. No telemetry. Your notes and your API key never touch any server except Anthropic's API — and only when you invoke an AI action.

## Features

**Notes**
- ✍️ Markdown editing with live preview (edit / split / preview modes), GFM tables and task lists
- 🔍 Instant full-text search with relevance ranking (title > tags > content)
- 🏷 Tagging with one-click filters and tag autocomplete from your vocabulary
- 📌 Pinned notes, relative timestamps, word counts
- 💾 Autosave to localStorage (debounced, flushed on page hide) — and a visible warning if storage ever rejects a write, so edits are never silently lost
- 📤 JSON export / import with validation and merge-on-import
- 🌗 Light / dark / system theme
- ⌨️ Shortcuts: `Ctrl/Cmd+K` search, `Ctrl/Cmd+Alt+N` new note, `Ctrl/Cmd+Enter` to ask AI

**AI (bring your own Anthropic API key)**
- 📄 **Summarize** — tight paragraph + key bullets, streamed live
- ✨ **Improve writing** — clarity/grammar/structure pass; previewed first, applied only when you accept
- 🪄 **Suggest title** — concise title from content
- 🏷 **Suggest tags** — 2–5 tags, preferring your existing tag vocabulary
- 💬 **Ask your notes** — question answering across all notes with cited sources; relevance-ranked context selection keeps requests small
- 🛑 Streaming output with a Stop button, friendly error messages, model picker (Opus 5 / Sonnet 5 / Haiku 4.5)

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

To enable AI features: **Settings → API key**, paste an Anthropic API key (get one at [platform.claude.com](https://platform.claude.com/)).

### Scripts

| Command             | What it does                     |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server             |
| `npm run build`     | Typecheck + production build     |
| `npm run preview`   | Serve the production build       |
| `npm test`          | Run the test suite (Vitest)      |
| `npm run lint`      | ESLint                           |
| `npm run typecheck` | TypeScript project check         |

## How it works

```
┌─────────────────────────── Browser ───────────────────────────┐
│                                                                │
│  React UI (sidebar · editor · AI panel)                        │
│    ├── lib/storage.ts    versioned localStorage, import/export │
│    ├── lib/search.ts     scored full-text search + context     │
│    │                     selection for Q&A                     │
│    ├── lib/markdown.ts   marked (GFM) + DOMPurify sanitizing   │
│    └── lib/ai.ts         @anthropic-ai/sdk (streaming)  ───────┼──► Anthropic API
│                                                                │    (only with your key,
│  localStorage: notes + settings (never leaves the browser)     │     only on AI actions)
└────────────────────────────────────────────────────────────────┘
```

Design decisions worth knowing:

- **Local-first**: the app is fully functional with zero network access; AI is an enhancement layer.
- **Sanitized rendering**: every markdown render passes through DOMPurify, so pasted or AI-generated content can't inject scripts.
- **Grounded Q&A**: "Ask your notes" selects the most relevant notes by search score, sends only those (within a character budget), and instructs the model to answer strictly from them and cite note titles.
- **Streaming-first AI**: long outputs stream token-by-token with abort support, using the official SDK's `messages.stream()`.

More detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Security notes

- Your API key is stored in `localStorage` and sent only to `api.anthropic.com` (the SDK's `dangerouslyAllowBrowser` mode — appropriate here because the key is yours and there is no server component). Don't enter a production key on a shared machine.
- Notes are stored unencrypted in the browser profile. Export regularly; treat the browser profile as the trust boundary.

## Development

- **Stack**: React 19, TypeScript (strict), Vite, Vitest + Testing Library, ESLint (typescript-eslint + react-hooks), marked + DOMPurify, `@anthropic-ai/sdk`.
- **Tests**: 71 tests across storage, search ranking, markdown sanitization, AI response parsing, note-state hooks, the error boundary, and app-level user flows. `npm test`.
- **CI**: GitHub Actions runs typecheck, lint, tests, and build on every push and PR.

## License

[MIT](LICENSE)
