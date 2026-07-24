import { useCallback, useEffect, useRef, useState } from 'react'
import type { GeneratedImage } from '../types'
import { clampIndex, lightboxKeyAction, stepIndex } from '../lib/lightbox'

interface ImageLightboxProps {
  images: GeneratedImage[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}

function ControlButton({
  label,
  onClick,
  className = '',
  children,
}: {
  label: string
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors ${className}`}
    >
      {children}
    </button>
  )
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const safeIndex = clampIndex(index, images.length)
  const image = images[safeIndex]

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void containerRef.current?.requestFullscreen?.().catch(() => undefined)
    }
  }, [])

  // The overlay owns the keyboard while it is open.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = lightboxKeyAction(event.key, images.length)
      if (!action) return
      event.preventDefault()

      if (action.type === 'close') {
        if (document.fullscreenElement) void document.exitFullscreen()
        else onClose()
      } else if (action.type === 'step') {
        onIndexChange(stepIndex(safeIndex, action.value ?? 0, images.length))
      } else if (action.type === 'jump') {
        onIndexChange(clampIndex(action.value ?? 0, images.length))
      } else {
        toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [images.length, safeIndex, onClose, onIndexChange, toggleFullscreen])

  // Keep the page behind the overlay still, and track native fullscreen state.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    containerRef.current?.focus()

    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  if (!image) return null

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Image ${safeIndex + 1} of ${images.length}`}
      tabIndex={-1}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm flex flex-col focus:outline-none"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-400">
        <span className="font-mono text-zinc-300">
          {safeIndex + 1} / {images.length}
        </span>
        <span className="truncate flex-1 text-xs">{image.prompt}</span>

        <a
          href={image.url}
          download={`image-${image.id}.png`}
          aria-label="Download image"
          title="Download image"
          className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>

        <ControlButton label={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'} onClick={toggleFullscreen}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isFullscreen ? (
              <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </ControlButton>

        <ControlButton label="Close (Esc)" onClick={onClose}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </ControlButton>
      </div>

      {/* Image stage */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <img
          src={image.url}
          alt={image.prompt}
          className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
        />

        {images.length > 1 && (
          <>
            {/* Overlaid so narrow screens keep the full image width */}
            <ControlButton
              label="Previous image (←)"
              onClick={() => onIndexChange(stepIndex(safeIndex, -1, images.length))}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-zinc-900/70"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ControlButton>

            <ControlButton
              label="Next image (→)"
              onClick={() => onIndexChange(stepIndex(safeIndex, 1, images.length))}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-zinc-900/70"
            >
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ControlButton>
          </>
        )}
      </div>

      {/* Slider */}
      {images.length > 1 && (
        <div className="px-6 py-4 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={images.length - 1}
            step={1}
            value={safeIndex}
            onChange={(e) => onIndexChange(Number(e.target.value))}
            aria-label="Scrub through images"
            className="w-full accent-violet-500"
          />
          <span className="text-[11px] text-zinc-500 whitespace-nowrap">← → · Esc · F</span>
        </div>
      )}
    </div>
  )
}
