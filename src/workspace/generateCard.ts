import type { Attachment, ImageModel } from '../types'
import { generateImages } from '../lib/openrouter'
import { imageDataUrl, storeImageUrl } from './images'
import { composeCardPrompt } from './prompt'
import type { Card, Project, Variant } from './types'

export interface CardGenerationResult {
  variants: Variant[]
  error?: string
}

/**
 * Style references and anchors share the model's reference limit. When both do
 * not fit, anchors keep at least half of the slots: they carry the series' look.
 */
export function pickReferences(styleIds: string[], anchorIds: string[], max: number): string[] {
  const style = [...new Set(styleIds)]
  const anchors = [...new Set(anchorIds)].filter((id) => !style.includes(id))
  if (max <= 0) return []
  const anchorSlots = style.length === 0 ? Math.min(anchors.length, max) : Math.min(anchors.length, Math.ceil(max / 2))
  const styleSlots = Math.min(style.length, max - anchorSlots)
  const picked = [...style.slice(0, styleSlots), ...anchors.slice(0, anchorSlots)]
  const spare = [...style.slice(styleSlots), ...anchors.slice(anchorSlots)]
  return [...picked, ...spare].slice(0, max)
}

export interface RetryOptions {
  maxAttempts: number
  delayMs: number
  sleep?: (ms: number) => Promise<void>
}

/** Retries a generation while it delivered nothing and failed for a transient reason. */
export async function withRetry(attempt: () => Promise<CardGenerationResult>, options: RetryOptions): Promise<CardGenerationResult> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  let result: CardGenerationResult = { variants: [] }
  for (let n = 1; n <= options.maxAttempts; n++) {
    try {
      result = await attempt()
    } catch (err) {
      result = { variants: [], error: errorMessage(err) }
    }
    if (result.variants.length > 0 || !isTransientError(result.error) || n === options.maxAttempts) return result
    await sleep(options.delayMs * n)
  }
  return result
}

async function referenceAttachments(imageIds: string[], max: number): Promise<Attachment[]> {
  const selected = imageIds.slice(0, max)
  const urls = await Promise.all(selected.map(imageDataUrl))
  return selected.flatMap((id, index): Attachment[] => {
    const data = urls[index]
    if (!data) return []
    const mimeType = data.match(/^data:([^;,]+)/)?.[1] ?? 'image/png'
    return [{ id, name: `reference-${index + 1}`, mimeType, size: data.length, kind: 'image', data }]
  })
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Generation failed.'
}

/** Generates the project's variant count for one card and stores every image that arrives. */
export async function generateCardVariants(
  apiKey: string,
  project: Project,
  card: Card,
  model: ImageModel,
  extraReferenceIds: string[] = []
): Promise<CardGenerationResult> {
  const referenceIds = pickReferences(project.referenceIds, extraReferenceIds, model.maxReferenceImages)
  const attachments = await referenceAttachments(referenceIds, referenceIds.length)
  const { images, cost } = generateImages(apiKey, {
    prompt: composeCardPrompt(project.styleGuide, card),
    count: project.settings.variantsPerCard,
    ratio: project.settings.ratio,
    model,
    attachments,
    outputFormat: project.settings.outputFormat,
  })

  const settled = await Promise.allSettled(
    images.map(async (image) => storeImageUrl(await image))
  )
  const imageIds = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
  const total = await cost
  const share = total !== null && imageIds.length > 0 ? total / imageIds.length : null
  const now = Date.now()
  const variants = imageIds.map((imageId) => ({ id: crypto.randomUUID(), imageId, createdAt: now, cost: share }))

  const failure = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  return failure ? { variants, error: errorMessage(failure.reason) } : { variants }
}

const TRANSIENT = /^OpenRouter error (408|425|429|5\d\d)\b|failed to fetch|network ?error|timed out|overloaded|rate.?limit/i

/** Errors worth one more try: throttling, provider hiccups, dropped connections. */
export function isTransientError(message: string | undefined): boolean {
  return Boolean(message && TRANSIENT.test(message))
}
