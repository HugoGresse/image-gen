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
