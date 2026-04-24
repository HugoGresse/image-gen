import { useState } from 'react'
import type { GeneratedImage, ImageSession, AspectRatio } from '../types'
import { ImageCard } from './ImageCard'

interface ImageGalleryProps {
  sessions: ImageSession[]
  onRevamp: (selectedImages: GeneratedImage[], originalPrompt: string, ratio: AspectRatio) => void
  isRevamping: boolean
}

export function ImageGallery({ sessions, onRevamp, isRevamping }: ImageGalleryProps) {
  const [selectionMode, setSelectionMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const allImages = sessions.flatMap((s) =>
    s.images.map((img) => ({ ...img, selected: selected.has(img.id) }))
  )
  const selectedImages = allImages.filter((img) => img.selected)
  const latestSession = sessions[0]

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleEnterSelectionMode() {
    setSelectionMode(true)
    setSelected(new Set())
  }

  function handleCancelSelection() {
    setSelectionMode(false)
    setSelected(new Set())
  }

  function handleRevamp() {
    if (!latestSession || selectedImages.length === 0) return
    onRevamp(selectedImages, latestSession.params.prompt, latestSession.params.ratio)
    setSelectionMode(false)
    setSelected(new Set())
  }

  if (sessions.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Gallery header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Generated Images
          <span className="ml-2 text-sm font-normal text-zinc-500">({allImages.length})</span>
        </h2>

        <div className="flex items-center gap-3">
          {!selectionMode ? (
            <button
              onClick={handleEnterSelectionMode}
              className="text-sm text-violet-400 hover:text-violet-300 border border-violet-500/40 hover:border-violet-400 px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <path d="M14 17h7M17 14v7" strokeLinecap="round" />
              </svg>
              Select for Revamp
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">
                {selectedImages.length} selected
              </span>
              <button
                onClick={handleRevamp}
                disabled={selectedImages.length === 0 || isRevamping}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2"
              >
                {isRevamping ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Revamping…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Revamp Selection
                  </>
                )}
              </button>
              <button
                onClick={handleCancelSelection}
                className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {selectionMode && (
        <p className="text-sm text-zinc-500">
          Click images to select them, then click <span className="text-violet-400">Revamp Selection</span> to generate improved variations.
        </p>
      )}

      {/* Sessions */}
      <div className="space-y-6">
        {sessions.map((session) => (
          <div key={session.id} className="space-y-3">
            <div className="flex items-start gap-3 text-xs text-zinc-500">
              <span className="bg-zinc-800 px-2 py-1 rounded font-mono">{session.params.model.split('/')[1]}</span>
              <span className="bg-zinc-800 px-2 py-1 rounded">{session.params.ratio}</span>
              <span className="truncate max-w-md">{session.params.prompt}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {session.images.map((image) => (
                <ImageCard
                  key={image.id}
                  image={{ ...image, selected: selected.has(image.id) }}
                  onToggleSelect={toggleSelect}
                  selectionMode={selectionMode}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
