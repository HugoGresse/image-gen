import { useState, useCallback } from 'react'
import { ApiKeyInput } from './components/ApiKeyInput'
import { GenerationForm } from './components/GenerationForm'
import { ImageGallery } from './components/ImageGallery'
import { getStoredApiKey } from './lib/storage'
import { generateImages, generateRevampedImages } from './lib/openrouter'
import { trackEvent } from './lib/analytics'
import type { GenerationParams, ImageSession, GeneratedImage } from './types'

function generateId() {
  return crypto.randomUUID()
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(getStoredApiKey)
  const [sessions, setSessions] = useState<ImageSession[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRevamping, setIsRevamping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = useCallback(
    async (params: GenerationParams) => {
      if (!apiKey) {
        setError('Please enter your OpenRouter API key first.')
        return
      }
      setIsLoading(true)
      setError(null)
      trackEvent('generate_images', { count: params.count, ratio: params.ratio, model: params.model })

      try {
        const urls = await generateImages(apiKey, params.prompt, params.count, params.ratio, params.model)
        const newSession: ImageSession = {
          id: generateId(),
          params,
          createdAt: Date.now(),
          images: urls.map((url) => ({
            id: generateId(),
            url,
            prompt: params.prompt,
            ratio: params.ratio,
            model: params.model,
            createdAt: Date.now(),
            selected: false,
          })),
        }
        setSessions((prev) => [newSession, ...prev])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to generate images.'
        setError(msg)
        trackEvent('generate_error')
      } finally {
        setIsLoading(false)
      }
    },
    [apiKey]
  )

  const handleRevamp = useCallback(
    async (selectedImages: GeneratedImage[], sourceParams: GenerationParams) => {
      if (!apiKey) return
      setIsRevamping(true)
      setError(null)
      trackEvent('revamp_images', { count: selectedImages.length })

      const { prompt, ratio, model } = sourceParams
      const count = Math.max(1, selectedImages.length)

      try {
        const urls = await generateRevampedImages(apiKey, prompt, count, ratio, model)
        const newSession: ImageSession = {
          id: generateId(),
          params: {
            prompt: `[Revamp] ${prompt}`,
            count: urls.length,
            ratio,
            model,
          },
          createdAt: Date.now(),
          images: urls.map((url) => ({
            id: generateId(),
            url,
            prompt: `[Revamp] ${prompt}`,
            ratio,
            model,
            createdAt: Date.now(),
            selected: false,
          })),
        }
        setSessions((prev) => [newSession, ...prev])
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to revamp images.'
        setError(msg)
        trackEvent('revamp_error')
      } finally {
        setIsRevamping(false)
      }
    },
    [apiKey]
  )

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center text-sm font-bold">IG</div>
            <h1 className="text-lg font-bold tracking-tight">Image Gen</h1>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">OpenRouter</span>
          </div>
          <ApiKeyInput apiKey={apiKey} onApiKeyChange={setApiKey} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Generation form card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-lg">
          <h2 className="text-base font-semibold text-zinc-200 mb-5 flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            New Generation
          </h2>
          {!apiKey && (
            <div className="mb-4 bg-amber-950/40 border border-amber-700/40 rounded-xl px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Enter your OpenRouter API key above to start generating images.
            </div>
          )}
          <GenerationForm onGenerate={handleGenerate} isLoading={isLoading} />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-950/40 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300 flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
            </svg>
            <div>
              <span className="font-semibold">Error: </span>
              {error}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <svg className="animate-spin h-4 w-4 text-violet-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating images…
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square bg-zinc-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        <ImageGallery
          sessions={sessions}
          onRevamp={handleRevamp}
          isRevamping={isRevamping}
        />

        {/* Empty state */}
        {sessions.length === 0 && !isLoading && (
          <div className="text-center py-20 text-zinc-600">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-sm">Your generated images will appear here</p>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-900 mt-16 py-6 text-center text-xs text-zinc-600">
        Powered by{' '}
        <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">
          OpenRouter
        </a>
        {' '}· API key stored locally in your browser only
      </footer>
    </div>
  )
}
