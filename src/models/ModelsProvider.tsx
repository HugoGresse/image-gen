import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { fetchImageModels } from '../lib/openrouter'
import { ModelsContext } from './modelsContext'
import type { ModelsState } from './modelsContext'

export function ModelsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModelsState>({ models: [], loading: true, error: null })

  useEffect(() => {
    fetchImageModels()
      .then((models) =>
        setState({
          models,
          loading: false,
          error: models.length === 0 ? 'No image generation models available.' : null,
        })
      )
      .catch((err: unknown) =>
        setState({ models: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load models.' })
      )
  }, [])

  return <ModelsContext.Provider value={state}>{children}</ModelsContext.Provider>
}
