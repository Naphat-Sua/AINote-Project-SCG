import Anthropic from '@anthropic-ai/sdk'
import type { Note, Settings } from '../types'
import { selectRelevantNotes } from './search'

export const DEFAULT_MODEL = 'claude-opus-5'

export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 — best quality (recommended)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 — fast and capable' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, lowest cost' },
]

/** Cap on how much of a single note is sent to the model. */
const MAX_NOTE_CHARS = 24_000
/** Total character budget for multi-note context in "ask your notes". */
const ASK_CONTEXT_BUDGET = 60_000

function createClient(settings: Settings): Anthropic {
  if (!settings.apiKey) {
    throw new Error('No API key configured. Add your Anthropic API key in Settings.')
  }
  // The key is supplied and stored by the user in their own browser; this app
  // has no backend, so direct browser access is the intended architecture.
  return new Anthropic({ apiKey: settings.apiKey, dangerouslyAllowBrowser: true })
}

function modelOf(settings: Settings): string {
  return settings.model || DEFAULT_MODEL
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…[truncated]`
}

function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === 'refusal') {
    throw new Error('The model declined this request.')
  }
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
}

interface StreamOptions {
  settings: Settings
  system: string
  prompt: string
  maxTokens: number
  onText?: (delta: string) => void
  signal?: AbortSignal
}

async function streamText(options: StreamOptions): Promise<string> {
  const client = createClient(options.settings)
  const stream = client.messages.stream(
    {
      model: modelOf(options.settings),
      max_tokens: options.maxTokens,
      system: options.system,
      messages: [{ role: 'user', content: options.prompt }],
    },
    { signal: options.signal },
  )
  if (options.onText) stream.on('text', options.onText)
  const final = await stream.finalMessage()
  return textOf(final)
}

export async function summarizeNote(
  settings: Settings,
  note: Note,
  onText?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return streamText({
    settings,
    system:
      'You summarize personal notes. Reply with a tight markdown summary: ' +
      'one short paragraph capturing the core idea, then 2-5 bullet points for key details ' +
      'or action items if any exist. No preamble, no headings.',
    prompt: `Summarize this note.\n\nTitle: ${note.title || '(untitled)'}\n\n${truncate(note.content, MAX_NOTE_CHARS)}`,
    maxTokens: 2048,
    onText,
    signal,
  })
}

export async function improveWriting(
  settings: Settings,
  note: Note,
  onText?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  return streamText({
    settings,
    system:
      'You edit personal notes. Improve clarity, flow, grammar, and markdown structure while ' +
      'preserving the meaning, voice, facts, and language of the original. ' +
      'Reply with ONLY the improved note content in markdown — no preamble, no commentary.',
    prompt: truncate(note.content, MAX_NOTE_CHARS),
    maxTokens: 8192,
    onText,
    signal,
  })
}

export async function suggestTitle(settings: Settings, note: Note, signal?: AbortSignal): Promise<string> {
  const raw = await streamText({
    settings,
    system:
      'You title personal notes. Reply with a single concise title (3-8 words) for the note. ' +
      'Plain text only: no quotes, no markdown, no trailing punctuation.',
    prompt: truncate(note.content, MAX_NOTE_CHARS),
    maxTokens: 1024,
    signal,
  })
  return raw.trim().replace(/^["'#\s]+|["'\s]+$/g, '').slice(0, 120)
}

/**
 * Extract a tag list from a model response. Accepts a bare JSON array,
 * a fenced JSON block, or a comma/newline separated list — models are
 * instructed to return JSON but this stays robust if they drift.
 */
export function parseTagsResponse(raw: string): string[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const attempt = (text: string): string[] | null => {
    try {
      const parsed: unknown = JSON.parse(text)
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === 'string')
      }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { tags?: unknown }).tags)) {
        return ((parsed as { tags: unknown[] }).tags).filter((t): t is string => typeof t === 'string')
      }
    } catch {
      // fall through to other formats
    }
    return null
  }
  const fromJson = attempt(cleaned) ?? attempt(cleaned.slice(cleaned.indexOf('['), cleaned.lastIndexOf(']') + 1))
  const list = fromJson ?? cleaned.split(/[,\n]/)
  return [...new Set(
    list
      .map((t) => t.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-'))
      .filter((t) => t.length > 0 && t.length <= 32),
  )].slice(0, 6)
}

export async function suggestTags(
  settings: Settings,
  note: Note,
  existingTags: string[],
  signal?: AbortSignal,
): Promise<string[]> {
  const vocabulary =
    existingTags.length > 0
      ? `Prefer reusing these existing tags when they fit: ${existingTags.slice(0, 40).join(', ')}.`
      : ''
  const raw = await streamText({
    settings,
    system:
      'You tag personal notes. Reply with ONLY a JSON array of 2-5 short lowercase tags ' +
      '(single words or hyphenated), e.g. ["project-x","meeting","budget"]. ' +
      `No other text. ${vocabulary}`,
    prompt: `Title: ${note.title || '(untitled)'}\n\n${truncate(note.content, MAX_NOTE_CHARS)}`,
    maxTokens: 1024,
    signal,
  })
  return parseTagsResponse(raw)
}

/** Build the context block sent to the model for "ask your notes". */
export function buildNotesContext(notes: Note[], budget = ASK_CONTEXT_BUDGET): string {
  const parts: string[] = []
  let used = 0
  for (const note of notes) {
    const body = truncate(note.content, MAX_NOTE_CHARS)
    const block = `<note title=${JSON.stringify(note.title || '(untitled)')} tags=${JSON.stringify(note.tags.join(', '))}>\n${body}\n</note>`
    if (used + block.length > budget && parts.length > 0) break
    parts.push(block)
    used += block.length
  }
  return parts.join('\n\n')
}

export interface AskResult {
  answer: string
  sources: Note[]
}

export async function askNotes(
  settings: Settings,
  question: string,
  notes: Note[],
  onText?: (delta: string) => void,
  signal?: AbortSignal,
): Promise<AskResult> {
  if (notes.length === 0) {
    throw new Error('There are no notes to search yet. Write a note first.')
  }
  const sources = selectRelevantNotes(notes, question)
  const context = buildNotesContext(sources)
  const answer = await streamText({
    settings,
    system:
      "You answer questions using ONLY the user's notes provided inside <note> blocks. " +
      'Cite the note titles you drew from, in **bold**, as you use them. ' +
      "If the notes don't contain the answer, say so plainly and do not invent details. " +
      'Be concise and answer in markdown.',
    prompt: `${context}\n\nQuestion: ${question}`,
    maxTokens: 4096,
    onText,
    signal,
  })
  return { answer, sources }
}

/** True when the failure was a user-initiated abort (not worth surfacing). */
export function isAbortError(error: unknown): boolean {
  if (error instanceof Anthropic.APIUserAbortError) return true
  return error instanceof Error && error.name === 'AbortError'
}

/** Map SDK errors to messages a person can act on. */
export function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return 'Your API key was rejected. Check it in Settings (it should start with "sk-ant-").'
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return 'Your API key does not have access to this model. Try another model in Settings.'
  }
  if (error instanceof Anthropic.NotFoundError) {
    return 'That model is not available for your account. Pick a different model in Settings.'
  }
  if (error instanceof Anthropic.RateLimitError) {
    return 'Rate limit reached. Wait a moment and try again.'
  }
  if (error instanceof Anthropic.BadRequestError) {
    return `The request was rejected: ${error.message}`
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return 'Could not reach the Anthropic API. Check your network connection.'
  }
  if (error instanceof Anthropic.APIError) {
    return `API error (${error.status ?? 'unknown'}): ${error.message}`
  }
  if (error instanceof Error) return error.message
  return 'Something went wrong.'
}
