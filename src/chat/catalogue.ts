/**
 * Chat model catalogue. The app has no backend, so the public `/models` list is
 * fetched from the browser and the last good copy is kept in localStorage for
 * when a refresh fails.
 */
const MODELS_URL = 'https://openrouter.ai/api/v1/models'
const CACHE_KEY = 'chat_models_cache'
const CACHE_TTL_MS = 60 * 60 * 1000

export interface ChatModel {
  id: string
  name: string
  author: string
  /** Unix seconds when OpenRouter added the model. */
  created: number | null
  contextLength: number | null
  promptPriceUsd: number | null
  completionPriceUsd: number | null
  priceVaries: boolean
  isAlias: boolean
  acceptsImages: boolean
}

export interface RouterInfo {
  id: string
  label: string
  explanation: string
}

export const ROUTERS: RouterInfo[] = [
  {
    id: 'openrouter/auto',
    label: 'Auto',
    explanation: 'OpenRouter picks a model per message; you pay the price of the model it picks.',
  },
  {
    id: 'openrouter/free',
    label: 'Free',
    explanation: 'Routes to free models: lower rate limits, and free endpoints may log prompts.',
  },
  {
    id: 'typesafe/jev-router',
    label: 'Jev router',
    explanation: 'Third-party general router; you pay the price of the model it picks.',
  },
]

export const DEFAULT_CHAT_MODEL = 'openrouter/auto'

const PRESET = String.raw`@preset/[\w.-]+`
const MODEL_ID = new RegExp(
  String.raw`^(?:${PRESET}|~?[A-Za-z0-9][\w.-]*/[\w.~-]+(?::[\w.-]+)?(?:${PRESET})?)$`
)

export function baseModelId(id: string): string {
  return id.trim().replace(/^~/, '').replace(/@preset\/.*$/, '').replace(/:.*$/, '')
}

function isAllowedRouter(id: string): boolean {
  return ROUTERS.some((router) => router.id === baseModelId(id))
}

export function isRouterModel(id: string, catalogue: ChatModel[] = []): boolean {
  const base = baseModelId(id)
  return isAllowedRouter(id) || base.startsWith('openrouter/') || catalogue.some((m) => m.id === base && m.priceVaries)
}

/** Null when valid, otherwise why the id is refused. */
export function modelIdProblem(id: string, catalogue: ChatModel[] = []): string | null {
  const trimmed = id.trim()
  if (!trimmed) return 'Enter a model id.'
  if (trimmed.length > 200 || !MODEL_ID.test(trimmed)) return 'Not a valid OpenRouter model id.'
  if (isRouterModel(trimmed, catalogue) && !isAllowedRouter(trimmed)) return 'This router is not supported here.'
  if (isAllowedRouter(trimmed) && trimmed.includes(':')) return 'Routers take no :variant.'
  return null
}

export function usableModelId(stored: string | null, catalogue: ChatModel[] = []): string {
  return stored && modelIdProblem(stored, catalogue) === null ? stored.trim() : DEFAULT_CHAT_MODEL
}

function parsePrice(raw: unknown): number | null {
  const value = Number(raw)
  return typeof raw === 'string' && Number.isFinite(value) && value >= 0 ? value : null
}

interface RawModel {
  id?: unknown
  name?: unknown
  created?: unknown
  context_length?: unknown
  pricing?: { prompt?: unknown; completion?: unknown }
  architecture?: { input_modalities?: unknown }
  supported_parameters?: unknown
}

/** Keeps models that can call tools; the chat cannot work without them. */
export function normaliseCatalogue(raw: RawModel[]): ChatModel[] {
  return raw.flatMap((entry): ChatModel[] => {
    if (typeof entry.id !== 'string') return []
    const params = Array.isArray(entry.supported_parameters) ? entry.supported_parameters : []
    if (!params.includes('tools')) return []
    const priceVaries = entry.pricing?.prompt === '-1' || entry.pricing?.completion === '-1'
    const modalities = Array.isArray(entry.architecture?.input_modalities) ? entry.architecture.input_modalities : []
    return [
      {
        id: entry.id,
        name: typeof entry.name === 'string' ? entry.name : entry.id,
        author: baseModelId(entry.id).split('/')[0],
        created: typeof entry.created === 'number' ? entry.created : null,
        contextLength: typeof entry.context_length === 'number' ? entry.context_length : null,
        promptPriceUsd: priceVaries ? null : parsePrice(entry.pricing?.prompt),
        completionPriceUsd: priceVaries ? null : parsePrice(entry.pricing?.completion),
        priceVaries,
        isAlias: entry.id.startsWith('~'),
        acceptsImages: modalities.includes('image'),
      },
    ]
  })
}

interface CachedCatalogue {
  fetchedAt: number
  models: ChatModel[]
}

export function readCache(): CachedCatalogue | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as CachedCatalogue | null
    return parsed && Array.isArray(parsed.models) ? parsed : null
  } catch {
    return null
  }
}

export async function fetchChatModels(now = Date.now()): Promise<ChatModel[]> {
  const cached = readCache()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.models
  try {
    const response = await fetch(MODELS_URL)
    if (!response.ok) throw new Error(`Failed to fetch chat models: ${response.status}`)
    const models = normaliseCatalogue(((await response.json()) as { data?: RawModel[] }).data ?? [])
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: now, models }))
    } catch {
      // A full storage only costs a refetch next time.
    }
    return models
  } catch (error) {
    if (cached) return cached.models
    throw error
  }
}

/** A model to judge images: the chat model when the catalogue says it reads images (or a router), else the default router. */
export function visionModelId(stored: string | null, catalogue: ChatModel[]): string {
  const id = usableModelId(stored, catalogue)
  const known = catalogue.find((model) => model.id === id)
  if (isRouterModel(id, catalogue)) return id
  return known?.acceptsImages ? id : DEFAULT_CHAT_MODEL
}
