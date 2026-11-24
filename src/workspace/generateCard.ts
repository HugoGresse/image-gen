import type { Attachment, ImageModel } from '../types'
import { generateImages } from '../lib/openrouter'
import { imageDataUrl, storeImageUrl } from './images'
import { composeCardPrompt } from './prompt'
import type { Card, Project, Variant } from './types'

export interface CardGenerationResult {
  variants: Variant[]
  error?: string
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
  const referenceIds = [...new Set([...project.referenceIds, ...extraReferenceIds])]
  const attachments = await referenceAttachments(referenceIds, model.maxReferenceImages)
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
