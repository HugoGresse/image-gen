import { createContext, useContext } from 'react'
import type { ImageModel } from '../types'

export interface ModelsState {
  models: ImageModel[]
  loading: boolean
  error: string | null
}

export const ModelsContext = createContext<ModelsState>({ models: [], loading: true, error: null })

export function useImageModels(): ModelsState {
  return useContext(ModelsContext)
}

export function findModel(models: ImageModel[], id: string): ImageModel | undefined {
  return models.find((model) => model.id === id)
}
