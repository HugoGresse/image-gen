/**
 * Ratios are declared per model by the Images API rather than fixed by the app,
 * so this stays a plain string (e.g. '1:1', '21:9', 'auto').
 */
export type AspectRatio = string

export const FALLBACK_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']

export interface ImageModel {
  id: string
  label: string
  description: string
  /** Release date as a unix timestamp in seconds. */
  createdAt: number | null
  /** Ratios the model accepts, or null when it does not expose the parameter. */
  aspectRatios: AspectRatio[] | null
  resolutions: string[] | null
  /** Images a single request may return (`n`). */
  maxImagesPerRequest: number
  /** Reference images the model accepts; 0 means text prompts only. */
  maxReferenceImages: number
  /** USD per image-output token; null when unpriced or variable (auto router). */
  imageOutputPrice: number | null
}

export type AttachmentKind = 'image' | 'pdf' | 'text'

export interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  kind: AttachmentKind
  /** data: URL for images and PDFs, decoded UTF-8 content for text documents. */
  data: string
}

export interface GenerationParams {
  prompt: string
  count: number
  ratio: AspectRatio
  model: ImageModel
  attachments?: Attachment[]
}

export interface GeneratedImage {
  id: string
  url: string
  prompt: string
  ratio: AspectRatio
  model: string
  createdAt: number
  selected: boolean
  loading?: boolean
}

export interface ImageSession {
  id: string
  params: GenerationParams
  images: GeneratedImage[]
  createdAt: number
}
