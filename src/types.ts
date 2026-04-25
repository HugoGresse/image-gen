export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3'

export interface GenerationParams {
  prompt: string
  count: number
  ratio: AspectRatio
  model: string
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
