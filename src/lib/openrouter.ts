import type { Attachment, AttachmentKind, GenerationParams, ImageModel } from '../types'
import { buildInputReferences, buildPrompt, planBatches, resolveAspectRatio } from './imageRequest'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_IMAGES_PER_REQUEST = 8

interface EnumParameter {
  type?: string
  values?: string[]
}

interface RangeParameter {
  type?: string
  min?: number
  max?: number
}

interface ImageModelEntry {
  id: string
  name: string
  description?: string
  created?: number
  supported_parameters?: {
    aspect_ratio?: EnumParameter
    resolution?: EnumParameter
    n?: RangeParameter
    input_references?: RangeParameter
  }
}

interface PricedModelEntry {
  id: string
  pricing?: Record<string, string>
}

/** OpenRouter reports unknown or variable prices as "-1"; treat those as unpriced. */
function parsePrice(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }
  return response.json()
}

/**
 * Models are described by the Images API, which is the only source for the
 * per-model limits (`n`, reference images, ratios). Pricing lives on the general
 * models endpoint, so it is merged in and treated as optional.
 */
export async function fetchImageModels(): Promise<ImageModel[]> {
  const [catalogue, priced] = await Promise.all([
    fetchJson('/images/models') as Promise<{ data: ImageModelEntry[] }>,
    (fetchJson('/models?output_modalities=image') as Promise<{ data: PricedModelEntry[] }>).catch(() => ({ data: [] })),
  ])

  const pricesById = new Map(priced.data.map((m) => [m.id, parsePrice(m.pricing?.image_output)]))

  return catalogue.data.map((entry) => {
    const params = entry.supported_parameters ?? {}
    return {
      id: entry.id,
      label: entry.name,
      description: entry.description ?? '',
      createdAt: entry.created ?? null,
      aspectRatios: params.aspect_ratio?.values ?? null,
      resolutions: params.resolution?.values ?? null,
      maxImagesPerRequest: params.n?.max ?? 1,
      maxReferenceImages: params.input_references?.max ?? 0,
      imageOutputPrice: pricesById.get(entry.id) ?? null,
    }
  })
}

/**
 * Attachment kinds the model cannot accept. Text documents are inlined into the
 * prompt, so they always work; the Images API has no document input, so PDFs
 * cannot be sent at all.
 */
export function unsupportedAttachmentKinds(
  attachments: Attachment[],
  model: ImageModel | undefined
): AttachmentKind[] {
  if (!model) return []
  const kinds = new Set(attachments.map((a) => a.kind))
  const unsupported: AttachmentKind[] = []
  if (kinds.has('image') && model.maxReferenceImages === 0) unsupported.push('image')
  if (kinds.has('pdf')) unsupported.push('pdf')
  return unsupported
}

interface ImagesResponseEntry {
  b64_json?: string
  media_type?: string
  url?: string
}

/** Turns an Images API payload into displayable URLs (base64 entries become data URLs). */
export function extractImages(payload: { data?: ImagesResponseEntry[] }): string[] {
  return (payload?.data ?? [])
    .map((entry) => {
      if (entry.url) return entry.url
      if (entry.b64_json) return `data:${entry.media_type ?? 'image/png'};base64,${entry.b64_json}`
      return ''
    })
    .filter(Boolean)
}

/** What the request actually cost, as billed by OpenRouter; null when not reported. */
export function extractCost(payload: { usage?: { cost?: number } }): number | null {
  const cost = payload?.usage?.cost
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : null
}

/** Sums what was reported, ignoring failed or unpriced requests. */
export function sumCosts(costs: (number | null)[]): number | null {
  const reported = costs.filter((cost): cost is number => cost !== null)
  return reported.length > 0 ? reported.reduce((total, cost) => total + cost, 0) : null
}

export interface Generation {
  /** One promise per image, resolving as each arrives. */
  images: Promise<string>[]
  /** Total billed cost once every request has settled. */
  cost: Promise<number | null>
}

interface ImageRequest {
  model: ImageModel
  prompt: string
  ratio: string
  n: number
  inputReferences: ReturnType<typeof buildInputReferences>
}

interface ImagesResult {
  images: string[]
  cost: number | null
}

async function requestImages(apiKey: string, request: ImageRequest): Promise<ImagesResult> {
  const aspectRatio = resolveAspectRatio(request.model, request.ratio)

  const response = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Image Gen Dashboard',
    },
    body: JSON.stringify({
      model: request.model.id,
      prompt: request.prompt,
      n: request.n,
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      ...(request.inputReferences.length > 0 ? { input_references: request.inputReferences } : {}),
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    const snippet = text.slice(0, 400)
    const suffix = text.length > 400 ? '… (truncated)' : ''
    throw new Error(`OpenRouter error ${response.status}: ${snippet}${suffix}`)
  }

  const payload = await response.json()
  const images = extractImages(payload)
  if (images.length === 0) {
    throw new Error('No image returned from OpenRouter. Please try again.')
  }
  return { images, cost: extractCost(payload) }
}

/** Splits one batch response into a promise per image slot. */
function spread(batch: Promise<ImagesResult>, size: number): Promise<string>[] {
  return Array.from({ length: size }, (_, index) =>
    batch.then((result) => {
      const url = result.images[index]
      if (!url) throw new Error('OpenRouter returned fewer images than requested.')
      return url
    })
  )
}

/** Total cost of a set of requests; failures contribute nothing rather than rejecting. */
function totalCost(requests: Promise<ImagesResult>[]): Promise<number | null> {
  return Promise.allSettled(requests).then((results) =>
    sumCosts(results.map((result) => (result.status === 'fulfilled' ? result.value.cost : null)))
  )
}

/**
 * Returns an array of individual promises — one per image — so the caller can
 * display each image as soon as it resolves. Requests are batched to the number
 * of images the model returns per call, and attachments ride along as the prompt
 * text (documents) and input references (images).
 */
export function generateImages(apiKey: string, params: GenerationParams): Generation {
  const { model } = params
  const count = Math.min(Math.max(params.count, 1), MAX_IMAGES_PER_REQUEST)
  const prompt = buildPrompt(params.prompt, params.attachments)
  const inputReferences = buildInputReferences(params.attachments, model.maxReferenceImages)

  const batches = planBatches(count, model.maxImagesPerRequest).map((size) => ({
    size,
    request: requestImages(apiKey, { model, prompt, ratio: params.ratio, n: size, inputReferences }),
  }))

  return {
    images: batches.flatMap(({ request, size }) => spread(request, size)),
    cost: totalCost(batches.map(({ request }) => request)),
  }
}

/**
 * Sends each selected image back as an input reference together with the user's
 * refinement hint, returning one promise per selected image.
 */
export function generateRevampedImages(
  apiKey: string,
  imageUrls: string[],
  refinementHint: string,
  ratio: string,
  model: ImageModel
): Generation {
  const prompt = refinementHint.trim()
    ? refinementHint.trim()
    : 'Refine and improve this image, enhancing detail, composition, and visual quality.'

  const requests = imageUrls.map((url) =>
    requestImages(apiKey, {
      model,
      prompt,
      ratio,
      n: 1,
      inputReferences: [{ type: 'image_url', image_url: { url } }],
    })
  )

  return {
    images: requests.map((request) => request.then((result) => result.images[0])),
    cost: totalCost(requests),
  }
}
