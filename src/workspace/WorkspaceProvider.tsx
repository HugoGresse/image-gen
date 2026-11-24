import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { ReactNode } from 'react'
import { findModel, useImageModels } from '../models/modelsContext'
import { deleteImages, deleteProjectRecord, loadProjects, saveProjects } from './db'
import { generateCardVariants, withRetry } from './generateCard'
import type { CardGenerationResult } from './generateCard'
import { forgetImageUrls, storeImageFile } from './images'
import {
  DEFAULT_VARIANTS_PER_CARD,
  anchorImageIds,
  initialWorkspace,
  nextToStart,
  referencedImageIds,
  workspaceReducer,
} from './reducer'
import type { WorkspaceAction } from './reducer'
import { defaultRatio, reconcileSettings } from './settings'
import type { Project, ProjectSettings, WorkspaceState } from './types'
import { WorkspaceContext, findProject } from './workspaceContext'
import type { WorkspaceActions } from './workspaceContext'

const SAVE_DELAY_MS = 500
const CONCURRENCY = 2
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 3000

interface WorkspaceProviderProps {
  apiKey: string
  onSpend: () => void
  onError: (message: string) => void
  children: ReactNode
}

function removeStoredImages(ids: string[], onError: (message: string) => void) {
  forgetImageUrls(ids)
  deleteImages(ids).catch(() => onError('Could not remove images from local storage.'))
}

export function WorkspaceProvider({ apiKey, onSpend, onError, children }: WorkspaceProviderProps) {
  const [state, rawDispatch] = useReducer(workspaceReducer, initialWorkspace)
  const stateRef = useRef<WorkspaceState>(initialWorkspace)
  const savedRef = useRef(new Map<string, Project>())
  const { models } = useImageModels()
  const live = useRef({ apiKey, models, onSpend, onError })

  useEffect(() => {
    live.current = { apiKey, models, onSpend, onError }
  })

  useEffect(() => {
    loadProjects()
      .then((projects) => {
        projects.forEach((project) => savedRef.current.set(project.id, project))
        dispatch({ type: 'loaded', projects })
      })
      .catch(() => {
        live.current.onError('Could not read your projects from local storage.')
        dispatch({ type: 'loaded', projects: [] })
      })
  }, [])

  useEffect(() => {
    if (!state.loaded) return
    function flush() {
      const changed = stateRef.current.projects.filter((project) => savedRef.current.get(project.id) !== project)
      if (changed.length === 0) return
      changed.forEach((project) => savedRef.current.set(project.id, project))
      saveProjects(changed).catch(() => {
        changed.forEach((project) => savedRef.current.delete(project.id))
        live.current.onError('Could not save your project to local storage.')
      })
    }
    const timer = setTimeout(flush, SAVE_DELAY_MS)
    window.addEventListener('pagehide', flush)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pagehide', flush)
    }
  }, [state.projects, state.loaded])

  useEffect(() => {
    const fallback = models[0]
    if (!state.loaded || !fallback) return
    state.projects
      .filter((project) => !project.settings.modelId)
      .forEach((project) =>
        dispatch({
          type: 'updateSettings',
          id: project.id,
          settings: reconcileSettings({ ...project.settings, modelId: fallback.id }, fallback),
          now: Date.now(),
        })
      )
  }, [models, state.loaded, state.projects])

  function dispatch(action: WorkspaceAction) {
    stateRef.current = workspaceReducer(stateRef.current, action)
    rawDispatch(action)
  }

  const actions = useMemo<WorkspaceActions>(() => {
    const now = () => Date.now()
    const project = (id: string) => findProject(stateRef.current, id)

    function defaultSettings(overrides: Partial<ProjectSettings>): ProjectSettings {
      const model = findModel(live.current.models, overrides.modelId ?? '') ?? live.current.models[0]
      const settings = {
        modelId: model?.id ?? '',
        ratio: overrides.ratio ?? defaultRatio(model),
        outputFormat: overrides.outputFormat,
        variantsPerCard: overrides.variantsPerCard ?? DEFAULT_VARIANTS_PER_CARD,
      }
      return reconcileSettings(settings, model)
    }

    async function generateCard(id: string, cardId: string): Promise<CardGenerationResult> {
      const target = project(id)
      const card = target?.cards.find((c) => c.id === cardId)
      if (!target || !card) return { variants: [], error: 'Card not found.' }
      if (card.status === 'generating') return { variants: [], error: 'This card is already being generated.' }
      const fail = (error: string): CardGenerationResult => {
        dispatch({ type: 'generationFinished', id, cardId, variants: [], error, now: now() })
        return { variants: [], error }
      }
      if (!live.current.apiKey) return fail('Enter your OpenRouter API key first.')
      const model = findModel(live.current.models, target.settings.modelId)
      if (!model) return fail(`Model ${target.settings.modelId || '(none)'} is not available.`)

      dispatch({ type: 'generationStarted', id, cardId })
      const result = await withRetry(
        () => generateCardVariants(live.current.apiKey, target, card, model, anchorImageIds(target, cardId)),
        { maxAttempts: MAX_ATTEMPTS, delayMs: RETRY_DELAY_MS }
      )

      const stillThere = project(id)?.cards.some((c) => c.id === cardId)
      if (stillThere) {
        dispatch({ type: 'generationFinished', id, cardId, variants: result.variants, error: result.error, now: now() })
      } else {
        removeStoredImages(result.variants.map((v) => v.imageId), live.current.onError)
      }
      live.current.onSpend()
      return result
    }

    return {
      getState: () => stateRef.current,
      setView: (view) => dispatch({ type: 'setView', view }),
      createProject: (name, settings = {}) => {
        const id = crypto.randomUUID()
        dispatch({ type: 'createProject', id, name, settings: defaultSettings(settings), now: now() })
        return id
      },
      selectProject: (id) => dispatch({ type: 'selectProject', id }),
      renameProject: (id, name) => dispatch({ type: 'renameProject', id, name, now: now() }),
      deleteProject: (id) => {
        const target = project(id)
        if (!target) return
        dispatch({ type: 'deleteProject', id })
        savedRef.current.delete(id)
        deleteProjectRecord(id).catch(() => live.current.onError('Could not delete the project from local storage.'))
        removeStoredImages(referencedImageIds(target), live.current.onError)
      },
      updateStyleGuide: (id, styleGuide) => dispatch({ type: 'updateStyleGuide', id, styleGuide, now: now() }),
      updateSettings: (id, settings) => {
        const current = project(id)
        if (!current) return
        const merged = { ...current.settings, ...settings }
        const reconciled = reconcileSettings(merged, findModel(live.current.models, merged.modelId))
        dispatch({ type: 'updateSettings', id, settings: reconciled, now: now() })
      },
      addReferenceFiles: async (id, files) => {
        const imageIds = await Promise.all(files.map(storeImageFile))
        dispatch({ type: 'addReferences', id, imageIds, now: now() })
      },
      removeReference: (id, imageId) => {
        dispatch({ type: 'removeReference', id, imageId, now: now() })
        removeStoredImages([imageId], live.current.onError)
      },
      addCards: (id, cards) => {
        const withIds = cards.map((card) => ({ ...card, id: crypto.randomUUID() }))
        dispatch({ type: 'addCards', id, cards: withIds, now: now() })
        return withIds.map((card) => card.id)
      },
      updateCard: (id, cardId, patch) => dispatch({ type: 'updateCard', id, cardId, patch, now: now() }),
      removeCard: (id, cardId) => {
        const card = project(id)?.cards.find((c) => c.id === cardId)
        dispatch({ type: 'removeCard', id, cardId, now: now() })
        if (card) removeStoredImages(card.variants.map((v) => v.imageId), live.current.onError)
      },
      queueCards: (id, cardIds) => {
        dispatch({ type: 'queueCards', id, cardIds })
        return project(id)?.cards.filter((c) => cardIds.includes(c.id) && c.status === 'queued').length ?? 0
      },
      cancelQueue: (id) => dispatch({ type: 'cancelQueue', id }),
      setAnchor: (id, cardId, anchor) => dispatch({ type: 'setAnchor', id, cardId, anchor, now: now() }),
      updateFrame: (id, frame) => dispatch({ type: 'updateFrame', id, frame, now: now() }),
      chooseVariant: (id, cardId, variantId) => dispatch({ type: 'chooseVariant', id, cardId, variantId, now: now() }),
      generateCard,
    }
  }, [])

  useEffect(() => {
    nextToStart(stateRef.current, CONCURRENCY).forEach(({ projectId, cardId }) => {
      void actions.generateCard(projectId, cardId)
    })
  }, [state.projects, actions])

  const value = useMemo(() => ({ state, actions }), [state, actions])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
