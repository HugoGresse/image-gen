export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'

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
  model: string
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
