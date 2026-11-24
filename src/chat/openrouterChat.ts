import { isRouterModel } from './catalogue'

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 90_000
const MAX_TOKENS = 4096

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }

export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: Record<string, unknown> }
}

export interface ChatRequest {
  model: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  responseFormat?: Record<string, unknown>
}

export interface ChatReply {
  message: Extract<ChatMessage, { role: 'assistant' }>
  /** The model that actually answered (differs from the request for routers). */
  servedModel: string
  cost: number | null
  truncated: boolean
}

/** Routers may pick a model that ignores tools or JSON mode unless told to require them. */
export function buildChatBody(request: ChatRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    max_tokens: MAX_TOKENS,
    ...(request.tools?.length ? { tools: request.tools, tool_choice: 'auto' } : {}),
    ...(request.responseFormat ? { response_format: request.responseFormat } : {}),
  }
  if (isRouterModel(request.model) || request.model.startsWith('@preset/')) {
    const provider = (body.provider as Record<string, unknown> | undefined) ?? {}
    body.provider = { ...provider, require_parameters: true }
  }
  return body
}

interface RawReply {
  model?: string
  error?: { message?: string; code?: unknown }
  choices?: { finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
  usage?: { cost?: number; is_byok?: boolean; cost_details?: { upstream_inference_cost?: number } }
}

export function billedCost(usage: RawReply['usage']): number | null {
  if (typeof usage?.cost !== 'number') return null
  const upstream = usage.is_byok ? (usage.cost_details?.upstream_inference_cost ?? 0) : 0
  return usage.cost + upstream
}

export function parseReply(raw: RawReply, requestedModel: string): ChatReply {
  const choice = raw.choices?.[0]
  if (!choice) throw new Error(raw.error?.message ?? 'The chat model returned no answer.')
  const content = choice.message?.content ?? null
  const toolCalls = choice.message?.tool_calls?.filter((call) => call.function?.name)
  const truncated = choice.finish_reason === 'length'
  if (truncated && !content && !toolCalls?.length) {
    throw new Error('The chat model ran out of tokens before answering.')
  }
  return {
    message: { role: 'assistant', content, ...(toolCalls?.length ? { tool_calls: toolCalls } : {}) },
    servedModel: raw.model ?? requestedModel,
    cost: billedCost(raw.usage),
    truncated,
  }
}

export async function sendChat(apiKey: string, request: ChatRequest, signal?: AbortSignal): Promise<ChatReply> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  try {
    return await postChat(apiKey, request, signal ? AbortSignal.any([signal, timeout]) : timeout)
  } catch (error) {
    if (timeout.aborted && !signal?.aborted) {
      throw new Error(`The chat model took longer than ${TIMEOUT_MS / 1000} s to answer.`, { cause: error })
    }
    throw error
  }
}

async function postChat(apiKey: string, request: ChatRequest, signal: AbortSignal): Promise<ChatReply> {
  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Image Gen Dashboard',
    },
    body: JSON.stringify(buildChatBody(request)),
    signal,
  })
  const text = await response.text()
  let raw: RawReply
  try {
    raw = JSON.parse(text) as RawReply
  } catch {
    throw new Error(`OpenRouter chat error ${response.status}: ${text.slice(0, 300)}`)
  }
  if (!response.ok) {
    throw new Error(`OpenRouter chat error ${response.status}: ${raw.error?.message ?? text.slice(0, 300)}`)
  }
  return parseReply(raw, request.model)
}
