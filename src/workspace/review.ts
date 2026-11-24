import { sendChat } from '../chat/openrouterChat'
import type { ContentPart } from '../chat/openrouterChat'
import { imageDataUrl } from './images'
import { pickReferences } from './generateCard'
import { anchorImageIds } from './reducer'
import type { Card, CardReview, Project } from './types'

const MAX_REVIEW_REFERENCES = 3
const THUMBNAIL_SIDE = 512
export const FLAG_THRESHOLD = 2

export const REVIEW_INSTRUCTIONS = `You check whether one illustration matches the visual style of a series.
Compare the LAST image with the reference images and the art direction: palette, technique, line work, lighting, level of detail, framing.
Ignore differences of subject: each item shows something different on purpose.
Answer with JSON only: {"score": 1-5, "issues": "short sentence, empty when none"}.
5 = indistinguishable style, 3 = noticeable drift, 1 = clearly another style.`

export function buildReviewContent(styleGuide: string, referenceUrls: string[], itemUrl: string, card: Pick<Card, 'title'>): ContentPart[] {
  return [
    { type: 'text', text: `Art direction:\n${styleGuide.trim() || '(none given: judge against the references only)'}` },
    ...(referenceUrls.length > 0 ? [{ type: 'text' as const, text: `Reference images (${referenceUrls.length}):` }] : []),
    ...referenceUrls.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    { type: 'text', text: `Image to check — "${card.title}":` },
    { type: 'image_url', image_url: { url: itemUrl } },
  ]
}

/** Tolerates prose or code fences around the JSON; scores are clamped to 1-5. */
export function parseReview(content: string | null): { score: number; issues: string } {
  const json = content?.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error('The reviewer did not return a score.')
  const parsed = JSON.parse(json) as { score?: unknown; issues?: unknown }
  const score = Number(parsed.score)
  if (!Number.isFinite(score)) throw new Error('The reviewer returned no numeric score.')
  return {
    score: Math.min(Math.max(Math.round(score), 1), 5),
    issues: typeof parsed.issues === 'string' ? parsed.issues.trim() : '',
  }
}

/** Vision models bill per pixel; a 512 px JPEG is plenty to judge style. */
async function thumbnail(imageId: string): Promise<string | undefined> {
  const source = await imageDataUrl(imageId)
  if (!source) return undefined
  const image = new Image()
  image.src = source
  await image.decode()
  const scale = Math.min(1, THUMBNAIL_SIDE / Math.max(image.naturalWidth || THUMBNAIL_SIDE, image.naturalHeight || THUMBNAIL_SIDE))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(Math.round((image.naturalWidth || THUMBNAIL_SIDE) * scale), 1)
  canvas.height = Math.max(Math.round((image.naturalHeight || THUMBNAIL_SIDE) * scale), 1)
  const context = canvas.getContext('2d')
  if (!context) return source
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export function chosenImageId(card: Card): string | undefined {
  return card.variants.find((variant) => variant.id === card.chosenVariantId)?.imageId
}

/** Anchors are the best evidence of the intended look; style references fill the remaining slots. */
export function reviewReferenceIds(project: Project, cardId: string): string[] {
  return pickReferences(project.referenceIds, anchorImageIds(project, cardId), MAX_REVIEW_REFERENCES * 2)
    .sort((a, b) => Number(project.referenceIds.includes(a)) - Number(project.referenceIds.includes(b)))
    .slice(0, MAX_REVIEW_REFERENCES)
}

/** Null when items can be judged, otherwise why not. */
export function reviewBasisProblem(project: Project): string | null {
  const hasAnchor = project.cards.some((card) => card.anchor && chosenImageId(card))
  return project.styleGuide.trim() || project.referenceIds.length > 0 || hasAnchor
    ? null
    : 'Add a style guide, style references or anchors first: there is nothing to compare with.'
}

export type ThumbnailCache = Map<string, Promise<string | undefined>>

export async function reviewCard(
  apiKey: string,
  model: string,
  project: Project,
  card: Card,
  cache: ThumbnailCache = new Map()
): Promise<CardReview> {
  const imageId = chosenImageId(card)
  if (!imageId) throw new Error('This item has no chosen image to check.')
  const referenceIds = reviewReferenceIds(project, card.id)
  if (referenceIds.length === 0 && !project.styleGuide.trim()) {
    throw new Error('This item is the only anchor: add a style guide, references or another anchor to compare with.')
  }
  const cached = (id: string) => {
    if (!cache.has(id)) cache.set(id, thumbnail(id))
    return cache.get(id) as Promise<string | undefined>
  }
  const [itemUrl, ...referenceUrls] = await Promise.all([thumbnail(imageId), ...referenceIds.map(cached)])
  if (!itemUrl) throw new Error('The image of this item is missing from local storage.')

  const reply = await sendChat(apiKey, {
    model,
    messages: [
      { role: 'system', content: REVIEW_INSTRUCTIONS },
      {
        role: 'user',
        content: buildReviewContent(project.styleGuide, referenceUrls.filter((url): url is string => Boolean(url)), itemUrl, card),
      },
    ],
    responseFormat: { type: 'json_object' },
  })
  const { score, issues } = parseReview(reply.message.content)
  return { score, issues, imageId, model: reply.servedModel, cost: reply.cost, reviewedAt: Date.now() }
}
