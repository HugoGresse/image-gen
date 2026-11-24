import type { ChatMessage } from './openrouterChat'

const MESSAGES_KEY = 'chat_messages'
const MODEL_KEY = 'chat_model'
export const MAX_STORED_MESSAGES = 80

/**
 * Every tool call must be answered before the next request, or the API rejects
 * the conversation; calls left open by a stop or an error get a stub answer.
 */
export function closeDanglingToolCalls(messages: ChatMessage[], reason: string): ChatMessage[] {
  const closed: ChatMessage[] = []
  let open: string[] = []
  const closeOpen = () => {
    open.forEach((id) => closed.push({ role: 'tool', tool_call_id: id, content: JSON.stringify({ ok: false, error: reason }) }))
    open = []
  }
  messages.forEach((message) => {
    if (message.role === 'tool') {
      if (!open.includes(message.tool_call_id)) return
      open = open.filter((id) => id !== message.tool_call_id)
      closed.push(message)
      return
    }
    closeOpen()
    closed.push(message)
    if (message.role === 'assistant') open = (message.tool_calls ?? []).map((call) => call.id)
  })
  closeOpen()
  return closed
}

/** Keeps the newest messages, starting on a user turn so no tool answer loses its call. */
export function trimHistory(messages: ChatMessage[], max = MAX_STORED_MESSAGES): ChatMessage[] {
  if (messages.length <= max) return messages
  const tail = messages.slice(messages.length - max)
  const start = tail.findIndex((m) => m.role === 'user')
  if (start !== -1) return tail.slice(start)
  const lastUser = messages.findLastIndex((m) => m.role === 'user')
  return lastUser === -1 ? [] : messages.slice(lastUser)
}

export function loadConversation(): ChatMessage[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MESSAGES_KEY) ?? '[]')
    return Array.isArray(parsed) ? closeDanglingToolCalls(parsed as ChatMessage[], 'Interrupted') : []
  } catch {
    return []
  }
}

export function saveConversation(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(trimHistory(messages)))
  } catch {
    // A full storage only loses the chat history.
  }
}

export function loadChatModel(): string | null {
  try {
    return localStorage.getItem(MODEL_KEY)
  } catch {
    return null
  }
}

export function saveChatModel(id: string): void {
  try {
    localStorage.setItem(MODEL_KEY, id)
  } catch {
    // Not worth surfacing.
  }
}

/** Display name of the tool each tool answer belongs to. */
export function toolNames(messages: ChatMessage[]): Map<string, string> {
  return new Map(
    messages.flatMap((m) => (m.role === 'assistant' ? (m.tool_calls ?? []).map((c) => [c.id, c.function.name] as const) : []))
  )
}
