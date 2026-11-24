import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { formatCost } from '../lib/money'
import { fetchChatModels, usableModelId } from './catalogue'
import type { ChatModel } from './catalogue'
import { ChatModelPicker } from './ChatModelPicker'
import { loadChatModel, saveChatModel, toolNames } from './conversation'
import type { ChatMessage } from './openrouterChat'
import { useChat } from './useChat'

interface ChatPanelProps {
  apiKey: string
  onSpend: () => void
  onClose: () => void
}

function toolOutcome(content: string): { ok: boolean; text: string } {
  try {
    const parsed = JSON.parse(content) as { ok?: boolean; error?: string; reason?: string }
    if (parsed.ok === false) return { ok: false, text: parsed.error ?? parsed.reason ?? 'failed' }
    return { ok: true, text: 'done' }
  } catch {
    return { ok: true, text: 'done' }
  }
}

function MessageView({ message, names }: { message: ChatMessage; names: Map<string, string> }) {
  if (message.role === 'tool') {
    const outcome = toolOutcome(message.content)
    return (
      <div className={`text-[11px] font-mono px-2 ${outcome.ok ? 'text-zinc-500' : 'text-amber-400'}`}>
        {outcome.ok ? '✓' : '✕'} {names.get(message.tool_call_id) ?? 'tool'}
        {!outcome.ok && ` — ${outcome.text}`}
      </div>
    )
  }
  if (message.role === 'system') return null
  const text = typeof message.content === 'string' ? message.content : (message.content ?? []).map((p) => (p.type === 'text' ? p.text : '')).join(' ')
  if (!text?.trim()) return null
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
          isUser ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-100'
        }`}
      >
        {text}
      </div>
    </div>
  )
}

export function ChatPanel({ apiKey, onSpend, onClose }: ChatPanelProps) {
  const [catalogue, setCatalogue] = useState<ChatModel[]>([])
  const [catalogueState, setCatalogueState] = useState<{ loading: boolean; error: string | null }>({ loading: true, error: null })
  const [model, setModel] = useState(() => usableModelId(loadChatModel()))
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const chat = useChat({ apiKey, model, catalogue, onSpend })
  const names = toolNames(chat.messages)
  const spent = formatCost(chat.spent)

  useEffect(() => {
    fetchChatModels()
      .then((models) => {
        setCatalogue(models)
        setCatalogueState({ loading: false, error: null })
      })
      .catch((err: unknown) =>
        setCatalogueState({ loading: false, error: err instanceof Error ? err.message : 'Could not load chat models.' })
      )
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [chat.messages, chat.pending, chat.busy])

  function handleModelChange(id: string) {
    setModel(id)
    saveChatModel(id)
  }

  function submit() {
    if (!draft.trim() || chat.busy) return
    void chat.send(draft)
    setDraft('')
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <aside className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800" aria-label="Assistant">
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-200">Assistant</h2>
          {spent && chat.spent > 0 && <span className="text-[10px] text-zinc-500 font-mono">{spent} this session</span>}
          <button type="button" onClick={chat.reset} className="ml-auto text-[11px] text-zinc-500 hover:text-zinc-300">
            New chat
          </button>
          <button type="button" onClick={onClose} aria-label="Close assistant" className="text-zinc-500 hover:text-white px-1">
            ✕
          </button>
        </div>
        <ChatModelPicker
          value={model}
          onChange={handleModelChange}
          catalogue={catalogue}
          loading={catalogueState.loading}
          error={catalogueState.error}
        />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {chat.messages.length === 0 && (
          <p className="text-xs text-zinc-500 leading-relaxed">
            Ask me to set up a project, write a style guide, add a list of items or generate them. Example: “Create a tarot
            deck project in an art nouveau style and add the 22 major arcana.”
          </p>
        )}
        {chat.messages.map((message, index) => (
          <MessageView key={index} message={message} names={names} />
        ))}
        {chat.busy && !chat.pending && <p className="text-xs text-zinc-500 animate-pulse">Thinking…</p>}
        {chat.servedBy && !chat.busy && <p className="text-[10px] text-zinc-600">Answered by {chat.servedBy} (picked by {model})</p>}
        {chat.pending && (
          <div className="border border-violet-500/40 bg-violet-500/10 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold text-white">{chat.pending.title}</p>
            <p className="text-xs text-zinc-300">{chat.pending.detail}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => chat.pending?.resolve(true)}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                {chat.pending.confirmLabel}
              </button>
              <button
                type="button"
                onClick={() => chat.pending?.resolve(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {chat.error && <p className="text-xs text-red-400 break-words">{chat.error}</p>}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          placeholder={apiKey ? 'Message the assistant… (Enter to send)' : 'Enter your OpenRouter API key first'}
          disabled={!apiKey}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none disabled:opacity-50"
        />
        <div className="flex justify-end mt-2">
          {chat.busy ? (
            <button type="button" onClick={chat.stop} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs px-3 py-1.5 rounded-lg">
              Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || !apiKey}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
