import type { ChatModel, RouterInfo } from './catalogue'
import { ROUTERS, isRouterModel, modelIdProblem } from './catalogue'

const MAJOR_AUTHORS = ['anthropic', 'openai', 'google', 'x-ai', 'meta-llama', 'mistralai', 'deepseek', 'qwen', 'moonshotai', 'z-ai']
const LATEST_COUNT = 6

export interface PickerRow {
  id: string
  meta: string
  detail: string | null
  badge: 'router' | 'alias' | null
}

export interface PickerGroup {
  title: string
  rows: PickerRow[]
}

const dateFormat = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

function contextLabel(model: ChatModel): string {
  if (!model.contextLength) return ''
  return model.contextLength >= 1_000_000
    ? `${Number((model.contextLength / 1_000_000).toFixed(1))}M ctx`
    : `${Math.round(model.contextLength / 1000)}K ctx`
}

export function priceLabel(model: ChatModel): string {
  if (model.priceVaries) return 'price varies'
  if (model.promptPriceUsd === 0 && model.completionPriceUsd === 0) return 'Free'
  if (model.promptPriceUsd === null || model.completionPriceUsd === null) return ''
  const perMillion = (usd: number) => `$${Number((usd * 1_000_000).toPrecision(3))}`
  return `${perMillion(model.promptPriceUsd)} · ${perMillion(model.completionPriceUsd)} /M`
}

function modelRow(model: ChatModel): PickerRow {
  return {
    id: model.id,
    meta: [priceLabel(model), contextLabel(model)].filter(Boolean).join(' · '),
    detail: model.created ? `Added to OpenRouter ${dateFormat.format(new Date(model.created * 1000))}` : null,
    badge: model.isAlias ? 'alias' : null,
  }
}

function routerRow(router: RouterInfo, catalogue: ChatModel[]): PickerRow {
  const model = catalogue.find((m) => m.id === router.id)
  return { id: router.id, meta: model ? priceLabel(model) : 'price varies', detail: router.explanation, badge: 'router' }
}

/** Models the picker may offer: valid ids, no batch-only variants, routers only through the allow-list group. */
export function selectableModels(catalogue: ChatModel[]): ChatModel[] {
  return catalogue.filter(
    (m) => !m.id.endsWith(':batch') && !isRouterModel(m.id, catalogue) && modelIdProblem(m.id, catalogue) === null
  )
}

function matches(needle: string, ...fields: string[]): boolean {
  return !needle || fields.some((field) => field.toLowerCase().includes(needle))
}

export function buildPickerGroups(catalogue: ChatModel[], selectable: ChatModel[], query: string): PickerGroup[] {
  const needle = query.trim().toLowerCase()
  const routers = ROUTERS.filter((r) => matches(needle, r.id, r.label)).map((r) => routerRow(r, catalogue))
  const models = selectable.filter((m) => matches(needle, m.id, m.name))
  const latest = models
    .filter((m) => MAJOR_AUTHORS.includes(m.author) && !m.isAlias)
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    .slice(0, LATEST_COUNT)

  const byAuthor = new Map<string, ChatModel[]>()
  models.forEach((m) => byAuthor.set(m.author, [...(byAuthor.get(m.author) ?? []), m]))
  const authors = [...byAuthor.keys()].sort((a, b) => a.localeCompare(b))

  return [
    { title: 'Routers', rows: routers },
    { title: 'Latest major', rows: latest.map(modelRow) },
    ...authors.map((author) => ({ title: author, rows: (byAuthor.get(author) ?? []).map(modelRow) })),
  ].filter((group) => group.rows.length > 0)
}

export function describeChoice(id: string, catalogue: ChatModel[]): { tone: 'info' | 'warning'; text: string } {
  const problem = modelIdProblem(id, catalogue)
  if (problem) return { tone: 'warning', text: problem }
  const router = ROUTERS.find((r) => r.id === id.trim())
  if (router) return { tone: 'info', text: router.explanation }
  const model = catalogue.find((m) => m.id === id.trim())
  if (model) return { tone: 'info', text: [model.name, contextLabel(model)].filter(Boolean).join(' · ') }
  return { tone: 'info', text: 'Custom id (not in the tool-capable catalogue)' }
}
