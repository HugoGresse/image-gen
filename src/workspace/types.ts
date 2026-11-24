import type { FrameSettings } from './frame'

export type View = 'studio' | 'projects'

export interface ProjectSettings {
  modelId: string
  /** Any ratio the model accepts; projects are not tied to card proportions. */
  ratio: string
  outputFormat?: string
  variantsPerCard: number
}

export type CardStatus = 'idle' | 'queued' | 'generating' | 'error'

export interface Variant {
  id: string
  imageId: string
  createdAt: number
  /** Share of the billed request cost; null when OpenRouter did not report it. */
  cost: number | null
}

export interface CardReview {
  /** 1 (another style) to 5 (indistinguishable from the series). */
  score: number
  issues: string
  /** The image that was judged; a review no longer applies once another variant is chosen. */
  imageId: string
  model: string
  cost: number | null
  reviewedAt: number
}

export interface Card {
  id: string
  title: string
  /** Free label drawn by the frame (e.g. "XIII"); empty for none. */
  number: string
  prompt: string
  status: CardStatus
  error?: string
  variants: Variant[]
  chosenVariantId?: string
  /** Anchors lend their chosen image as a style reference to every other item. */
  anchor?: boolean
  review?: CardReview
  reviewing?: boolean
  reviewError?: string
}

export interface Project {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  /** Shared art direction prepended to every card prompt. */
  styleGuide: string
  /** Image ids sent as input references with every card. */
  referenceIds: string[]
  settings: ProjectSettings
  /** Drawn by the app around each illustration; absent on projects made before frames existed. */
  frame?: FrameSettings
  cards: Card[]
}

export interface WorkspaceState {
  view: View
  projects: Project[]
  activeProjectId: string | null
  loaded: boolean
}

export interface NewCard {
  title: string
  number?: string
  prompt: string
}
