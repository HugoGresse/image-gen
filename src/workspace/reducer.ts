import type { Card, NewCard, Project, ProjectSettings, Variant, View, WorkspaceState } from './types'

export const DEFAULT_VARIANTS_PER_CARD = 2
export const MAX_VARIANTS_PER_CARD = 4

export type WorkspaceAction =
  | { type: 'loaded'; projects: Project[] }
  | { type: 'setView'; view: View }
  | { type: 'createProject'; id: string; name: string; settings: ProjectSettings; now: number }
  | { type: 'selectProject'; id: string | null }
  | { type: 'renameProject'; id: string; name: string; now: number }
  | { type: 'deleteProject'; id: string }
  | { type: 'updateStyleGuide'; id: string; styleGuide: string; now: number }
  | { type: 'updateSettings'; id: string; settings: Partial<ProjectSettings>; now: number }
  | { type: 'addReferences'; id: string; imageIds: string[]; now: number }
  | { type: 'removeReference'; id: string; imageId: string; now: number }
  | { type: 'addCards'; id: string; cards: (NewCard & { id: string })[]; now: number }
  | { type: 'updateCard'; id: string; cardId: string; patch: Partial<Pick<Card, 'title' | 'number' | 'prompt'>>; now: number }
  | { type: 'removeCard'; id: string; cardId: string; now: number }
  | { type: 'generationStarted'; id: string; cardId: string }
  | { type: 'generationFinished'; id: string; cardId: string; variants: Variant[]; error?: string; now: number }
  | { type: 'chooseVariant'; id: string; cardId: string; variantId: string; now: number }
  | { type: 'queueCards'; id: string; cardIds: string[] }
  | { type: 'cancelQueue'; id: string }
  | { type: 'setAnchor'; id: string; cardId: string; anchor: boolean; now: number }

export const initialWorkspace: WorkspaceState = { view: 'studio', projects: [], activeProjectId: null, loaded: false }

export function clampVariants(value: number): number {
  return Math.min(Math.max(Math.trunc(value) || 1, 1), MAX_VARIANTS_PER_CARD)
}

/**
 * A generation cannot survive a reload, and a queue must not resume spending
 * without the user, so cards left queued or mid-flight are put back to idle.
 */
export function sanitizeProject(project: Project): Project {
  return {
    ...project,
    cards: project.cards.map((card) =>
      card.status === 'generating' || card.status === 'queued' ? { ...card, status: 'idle' } : card
    ),
  }
}

function mapProject(state: WorkspaceState, id: string, now: number | null, update: (project: Project) => Project) {
  return {
    ...state,
    projects: state.projects.map((project) => {
      if (project.id !== id) return project
      const next = update(project)
      return now === null ? next : { ...next, updatedAt: now }
    }),
  }
}

function mapCard(project: Project, cardId: string, update: (card: Card) => Card): Project {
  return { ...project, cards: project.cards.map((card) => (card.id === cardId ? update(card) : card)) }
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case 'loaded': {
      const known = new Set(state.projects.map((project) => project.id))
      const projects = [...state.projects, ...action.projects.filter((p) => !known.has(p.id)).map(sanitizeProject)]
      return { ...state, loaded: true, projects, activeProjectId: state.activeProjectId ?? projects[0]?.id ?? null }
    }
    case 'setView':
      return { ...state, view: action.view }
    case 'createProject': {
      const project: Project = {
        id: action.id,
        name: action.name.trim() || 'Untitled project',
        createdAt: action.now,
        updatedAt: action.now,
        styleGuide: '',
        referenceIds: [],
        settings: { ...action.settings, variantsPerCard: clampVariants(action.settings.variantsPerCard) },
        cards: [],
      }
      return { ...state, view: 'projects', projects: [project, ...state.projects], activeProjectId: project.id }
    }
    case 'selectProject':
      return { ...state, activeProjectId: action.id, view: action.id ? 'projects' : state.view }
    case 'renameProject':
      return mapProject(state, action.id, action.now, (p) => ({ ...p, name: action.name }))
    case 'deleteProject': {
      const projects = state.projects.filter((p) => p.id !== action.id)
      const activeProjectId = state.activeProjectId === action.id ? (projects[0]?.id ?? null) : state.activeProjectId
      return { ...state, projects, activeProjectId }
    }
    case 'updateStyleGuide':
      return mapProject(state, action.id, action.now, (p) => ({ ...p, styleGuide: action.styleGuide }))
    case 'updateSettings':
      return mapProject(state, action.id, action.now, (p) => {
        const settings = { ...p.settings, ...action.settings }
        return { ...p, settings: { ...settings, variantsPerCard: clampVariants(settings.variantsPerCard) } }
      })
    case 'addReferences':
      return mapProject(state, action.id, action.now, (p) => ({
        ...p,
        referenceIds: [...new Set([...p.referenceIds, ...action.imageIds])],
      }))
    case 'removeReference':
      return mapProject(state, action.id, action.now, (p) => ({
        ...p,
        referenceIds: p.referenceIds.filter((imageId) => imageId !== action.imageId),
      }))
    case 'addCards':
      return mapProject(state, action.id, action.now, (p) => ({
        ...p,
        cards: [
          ...p.cards,
          ...action.cards.map((card) => ({
            id: card.id,
            title: card.title.trim(),
            number: card.number?.trim() ?? '',
            prompt: card.prompt.trim(),
            status: 'idle' as const,
            variants: [],
          })),
        ],
      }))
    case 'updateCard':
      return mapProject(state, action.id, action.now, (p) => mapCard(p, action.cardId, (c) => ({ ...c, ...action.patch })))
    case 'removeCard':
      return mapProject(state, action.id, action.now, (p) => ({
        ...p,
        cards: p.cards.filter((card) => card.id !== action.cardId),
      }))
    case 'generationStarted':
      return mapProject(state, action.id, null, (p) =>
        mapCard(p, action.cardId, (c) => ({ ...c, status: 'generating', error: undefined }))
      )
    case 'generationFinished':
      return mapProject(state, action.id, action.now, (p) =>
        mapCard(p, action.cardId, (c) => {
          const variants = [...c.variants, ...action.variants]
          return {
            ...c,
            variants,
            status: action.error && action.variants.length === 0 ? 'error' : 'idle',
            error: action.error,
            chosenVariantId: action.variants[0]?.id ?? c.chosenVariantId,
          }
        })
      )
    case 'queueCards':
      return mapProject(state, action.id, null, (p) => ({
        ...p,
        cards: p.cards.map((card) =>
          action.cardIds.includes(card.id) && card.status !== 'generating' && card.status !== 'queued'
            ? { ...card, status: 'queued', error: undefined }
            : card
        ),
      }))
    case 'cancelQueue':
      return mapProject(state, action.id, null, (p) => ({
        ...p,
        cards: p.cards.map((card) => (card.status === 'queued' ? { ...card, status: 'idle' } : card)),
      }))
    case 'setAnchor':
      return mapProject(state, action.id, action.now, (p) => mapCard(p, action.cardId, (c) => ({ ...c, anchor: action.anchor })))
    case 'chooseVariant':
      return mapProject(state, action.id, action.now, (p) =>
        mapCard(p, action.cardId, (c) =>
          c.variants.some((v) => v.id === action.variantId) ? { ...c, chosenVariantId: action.variantId } : c
        )
      )
  }
}

export function projectLabel(project: Project): string {
  return project.name.trim() || 'Untitled project'
}

export function activeProject(state: WorkspaceState): Project | undefined {
  return state.projects.find((project) => project.id === state.activeProjectId)
}

/** Every image a project still points at, so orphans can be removed from storage. */
export function referencedImageIds(project: Project): string[] {
  return [...project.referenceIds, ...project.cards.flatMap((card) => card.variants.map((variant) => variant.imageId))]
}

export interface QueuedCard {
  projectId: string
  cardId: string
}

/** Queued items to start now so that at most `concurrency` generations run at once. */
export function nextToStart(state: WorkspaceState, concurrency: number): QueuedCard[] {
  const cards = state.projects.flatMap((project) => project.cards.map((card) => ({ projectId: project.id, card })))
  const running = cards.filter(({ card }) => card.status === 'generating').length
  return cards
    .filter(({ card }) => card.status === 'queued')
    .slice(0, Math.max(concurrency - running, 0))
    .map(({ projectId, card }) => ({ projectId, cardId: card.id }))
}

/** Chosen images of the project's anchors, lent as references to the other items. */
export function anchorImageIds(project: Project, exceptCardId: string): string[] {
  return project.cards.flatMap((card) => {
    if (!card.anchor || card.id === exceptCardId) return []
    const chosen = card.variants.find((variant) => variant.id === card.chosenVariantId)
    return chosen ? [chosen.imageId] : []
  })
}

export function queueCounts(project: Project): { queued: number; generating: number } {
  return {
    queued: project.cards.filter((card) => card.status === 'queued').length,
    generating: project.cards.filter((card) => card.status === 'generating').length,
  }
}
