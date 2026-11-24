import { createContext, useContext } from 'react'
import type { CardGenerationResult } from './generateCard'
import type { FrameSettings } from './frame'
import type { Card, NewCard, Project, ProjectSettings, View, WorkspaceState } from './types'

export interface ReviewSummary {
  reviewed: number
  flagged: number
  failed: number
  cost: number
}

export interface WorkspaceActions {
  setView: (view: View) => void
  createProject: (name: string, settings?: Partial<ProjectSettings>) => string
  selectProject: (id: string | null) => void
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  updateStyleGuide: (id: string, styleGuide: string) => void
  updateSettings: (id: string, settings: Partial<ProjectSettings>) => void
  addReferenceFiles: (id: string, files: Blob[]) => Promise<void>
  removeReference: (id: string, imageId: string) => void
  addCards: (id: string, cards: NewCard[]) => string[]
  updateCard: (id: string, cardId: string, patch: Partial<Pick<Card, 'title' | 'number' | 'prompt'>>) => void
  removeCard: (id: string, cardId: string) => void
  chooseVariant: (id: string, cardId: string, variantId: string) => void
  /** Queues items for generation; returns how many were queued. Runs a few at a time. */
  queueCards: (id: string, cardIds: string[]) => number
  cancelQueue: (id: string) => void
  setAnchor: (id: string, cardId: string, anchor: boolean) => void
  updateFrame: (id: string, frame: Partial<FrameSettings>) => void
  generateCard: (id: string, cardId: string) => Promise<CardGenerationResult>
  /** Asks a vision model how well each chosen image matches the series (spends credit). */
  reviewCards: (id: string, cardIds: string[]) => Promise<ReviewSummary>
  /** Latest state, readable from async code (chat tools) without waiting for a render. */
  getState: () => WorkspaceState
}

export interface WorkspaceValue {
  state: WorkspaceState
  actions: WorkspaceActions
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

export function findProject(state: WorkspaceState, id: string): Project | undefined {
  return state.projects.find((project) => project.id === id)
}
