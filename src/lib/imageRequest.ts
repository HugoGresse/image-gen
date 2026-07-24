import type { Attachment, ImageModel } from '../types'

export interface InputReference {
  type: 'image_url'
  image_url: { url: string }
}

/**
 * The Images API takes a single prompt string, so text documents are inlined as
 * labelled reference blocks. Images travel separately as input references.
 */
export function buildPrompt(prompt: string, attachments: Attachment[] = []): string {
  const references = attachments
    .filter((a) => a.kind === 'text' && a.data.trim())
    .map((a) => `--- Reference document: ${a.name} ---\n${a.data.trim()}`)
  return [prompt, ...references].join('\n\n')
}

/** Attached images become input references, capped at what the model accepts. */
export function buildInputReferences(attachments: Attachment[] = [], maxReferences = 0): InputReference[] {
  if (maxReferences <= 0) return []
  return attachments
    .filter((a) => a.kind === 'image' && a.data)
    .slice(0, maxReferences)
    .map((a) => ({ type: 'image_url', image_url: { url: a.data } }))
}

/**
 * Splits a requested image count into per-request batches, since models cap how
 * many images one call may return (`n`).
 */
export function planBatches(count: number, maxPerRequest: number): number[] {
  const total = Math.max(Math.trunc(count), 0)
  const perRequest = Math.max(Math.trunc(maxPerRequest), 1)
  const batches: number[] = []
  for (let remaining = total; remaining > 0; remaining -= perRequest) {
    batches.push(Math.min(remaining, perRequest))
  }
  return batches
}

/** Aspect ratio is only sent to models that declare the parameter. */
export function resolveAspectRatio(model: ImageModel, ratio: string): string | undefined {
  if (!model.aspectRatios) return undefined
  return model.aspectRatios.includes(ratio) ? ratio : model.aspectRatios[0]
}
