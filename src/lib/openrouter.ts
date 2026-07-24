import type { AspectRatio, Attachment, AttachmentKind, GenerationParams } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_IMAGES_PER_REQUEST = 8

export interface ImageModel {
  id: string
  label: string
  description: string
  /** Accepts uploaded images as input (not just image output). */
  supportsImageInput: boolean
  /** Accepts PDF documents as input. */
  supportsFileInput: boolean
  /** USD per image-output token; null when unpriced or variable (auto router). */
  imageOutputPrice: number | null
  /** USD per prompt token. */
  promptPrice: number | null
  contextLength: number | null
  /** Release date as a unix timestamp in seconds. */
  createdAt: number | null
}

interface OpenRouterModelEntry {
  id: string
  name: string
  description?: string
  created?: number
  context_length?: number
  pricing?: Record<string, string>
  architecture?: {
    modality?: string
    input_modalities?: string[]
    output_modalities?: string[]
  }
}

/** OpenRouter reports unknown or variable prices as "-1"; treat those as unpriced. */
function parsePrice(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/** Newer entries expose modality arrays; older ones only the `input->output` string. */
function modalities(entry: OpenRouterModelEntry, side: 'input' | 'output'): string[] {
  const arch = entry.architecture
  const explicit = side === 'input' ? arch?.input_modalities : arch?.output_modalities
  if (explicit?.length) return explicit

  const parts = arch?.modality?.split('->')
  if (!parts || parts.length !== 2) return []
  return parts[side === 'input' ? 0 : 1].split('+')
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'file'; file: { filename: string; file_data: string } }

export async function fetchImageModels(): Promise<ImageModel[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`)
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }
  const data = await response.json()
  return (data.data as OpenRouterModelEntry[])
    .filter((m) => modalities(m, 'output').some((mod) => mod.includes('image')))
    .map((m) => {
      const inputs = modalities(m, 'input')
      return {
        id: m.id,
        label: m.name,
        description: m.description ?? '',
        supportsImageInput: inputs.some((mod) => mod.includes('image')),
        supportsFileInput: inputs.some((mod) => mod.includes('file')),
        imageOutputPrice: parsePrice(m.pricing?.image_output),
        promptPrice: parsePrice(m.pricing?.prompt),
        contextLength: m.context_length ?? null,
        createdAt: m.created ?? null,
      }
    })
}

/**
 * Attachment kinds the model cannot accept. Text documents are inlined into the
 * prompt, so they are always supported; images and PDFs need model capabilities.
 */
export function unsupportedAttachmentKinds(attachments: Attachment[], model: ImageModel | undefined): AttachmentKind[] {
  if (!model) return []
  const kinds = new Set(attachments.map((a) => a.kind))
  const unsupported: AttachmentKind[] = []
  if (kinds.has('image') && !model.supportsImageInput) unsupported.push('image')
  if (kinds.has('pdf') && !model.supportsFileInput) unsupported.push('pdf')
  return unsupported
}

/**
 * Builds the user message content: a plain string when there is nothing attached,
 * otherwise a multimodal array with images and PDFs as their own parts and text
 * documents inlined as reference blocks after the prompt.
 */
export function buildUserContent(prompt: string, attachments: Attachment[] = []): string | ContentPart[] {
  if (attachments.length === 0) return prompt

  const parts: ContentPart[] = []
  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      parts.push({ type: 'image_url', image_url: { url: attachment.data } })
    } else if (attachment.kind === 'pdf') {
      parts.push({ type: 'file', file: { filename: attachment.name, file_data: attachment.data } })
    }
  }

  const references = attachments
    .filter((a) => a.kind === 'text' && a.data.trim())
    .map((a) => `--- Reference document: ${a.name} ---\n${a.data.trim()}`)

  parts.push({ type: 'text', text: [prompt, ...references].join('\n\n') })
  return parts
}

interface ChatCompletionResponse {
  choices?: {
    message?: {
      images?: { image_url?: { url?: string } }[]
      content?: string | { type?: string; text?: string }[]
    }
  }[]
}

/**
 * Pulls the generated image out of a chat completion. Models sometimes answer with
 * text instead of an image, so the text is returned as well for the error message.
 */
export function extractImage(data: ChatCompletionResponse): { url: string | null; text: string } {
  const message = data?.choices?.[0]?.message
  const content = message?.content
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.filter((part) => part?.type === 'text').map((part) => part.text ?? '').join(' ')
      : ''

  return { url: message?.images?.[0]?.image_url?.url ?? null, text: text.trim() }
}

/** Single chat-completions call that returns one generated image URL. */
async function requestImage(
  apiKey: string,
  model: string,
  content: string | ContentPart[],
  ratio: AspectRatio,
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Image Gen Dashboard',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      // Both modalities are required: reasoning image models (OpenAI GPT-5 Image)
      // answer with plain text and skip image output when only "image" is asked for.
      modalities: ['image', 'text'],
      image_config: { aspect_ratio: ratio },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    const snippet = text.slice(0, 400)
    const suffix = text.length > 400 ? '… (truncated)' : ''
    throw new Error(`OpenRouter error ${response.status}: ${snippet}${suffix}`)
  }

  const { url, text } = extractImage(await response.json())
  if (!url) {
    const reply = text.length > 300 ? `${text.slice(0, 300)}…` : text
    throw new Error(
      reply
        ? `${model} replied with text instead of an image: ${reply}`
        : 'No image returned from OpenRouter. Please try again.'
    )
  }
  return url
}

/**
 * Returns an array of individual promises — one per image — so the caller can
 * display each image as soon as it resolves rather than waiting for the full batch.
 * Uploaded images and reference documents are sent alongside the prompt.
 */
export function generateImages(apiKey: string, params: GenerationParams): Promise<string>[] {
  const safeCount = Math.min(Math.max(params.count, 1), MAX_IMAGES_PER_REQUEST)
  const content = buildUserContent(params.prompt, params.attachments)
  return Array.from({ length: safeCount }, () => requestImage(apiKey, params.model, content, params.ratio))
}

/**
 * For each selected image URL, sends it together with the user's refinement
 * hint to the model as a multimodal request and returns one promise per image.
 */
export function generateRevampedImages(
  apiKey: string,
  imageUrls: string[],
  refinementHint: string,
  ratio: AspectRatio,
  model: string
): Promise<string>[] {
  const instruction = refinementHint.trim()
    ? refinementHint.trim()
    : 'Refine and improve this image, enhancing detail, composition, and visual quality.'

  return imageUrls.map((url) =>
    requestImage(
      apiKey,
      model,
      [
        { type: 'image_url', image_url: { url } },
        { type: 'text', text: instruction },
      ],
      ratio,
    )
  )
}
