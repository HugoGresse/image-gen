import type { ImageModel } from '../types'
import { formatUsd } from './money'

const RECENT_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Image output is billed per token, so prices are shown per 1K image tokens —
 * comparable across models without guessing tokens per image.
 */
export function formatImageOutputPrice(pricePerToken: number | null): string | null {
  if (pricePerToken === null || pricePerToken === 0) return null
  return `${formatUsd(pricePerToken * 1_000)}/1K img`
}

export function formatBatchSize(maxImagesPerRequest: number): string {
  return maxImagesPerRequest > 1 ? `${maxImagesPerRequest}/request` : '1/request'
}

export function formatReferenceSupport(maxReferenceImages: number): string {
  if (maxReferenceImages <= 0) return 'No reference images'
  return maxReferenceImages === 1 ? '1 reference image' : `Up to ${maxReferenceImages} references`
}

export function formatReleaseDate(createdSeconds: number | null): string | null {
  if (!createdSeconds) return null
  const date = new Date(createdSeconds * 1_000)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(date)
}

/** Flags models released within the last two months so new options stand out. */
export function isRecentRelease(createdSeconds: number | null, nowMs: number): boolean {
  if (!createdSeconds) return false
  const ageMs = nowMs - createdSeconds * 1_000
  return ageMs >= 0 && ageMs < RECENT_DAYS * DAY_MS
}

/** Model descriptions are markdown; keep the first sentence as readable plain text. */
export function summarizeDescription(description: string): string {
  const plain = description
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const firstSentence = plain.match(/^.*?[.!?](?=\s|$)/)?.[0]
  return firstSentence ?? plain
}

export function acceptsReferenceImages(model: ImageModel): boolean {
  return model.maxReferenceImages > 0
}

/** Pricing, batch size, and release facts shown as a compact meta line. */
export function modelMetaParts(model: ImageModel): string[] {
  return [
    formatImageOutputPrice(model.imageOutputPrice),
    formatBatchSize(model.maxImagesPerRequest),
    model.resolutions?.length ? model.resolutions.join('/') : null,
    formatReleaseDate(model.createdAt),
  ].filter((part): part is string => part !== null)
}
