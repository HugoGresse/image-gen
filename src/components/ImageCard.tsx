import type { GeneratedImage } from '../types'

interface ImageCardProps {
  image: GeneratedImage
  onToggleSelect: () => void
  selectionMode: boolean
  selectionDisabled?: boolean
}

export function ImageCard({ image, onToggleSelect, selectionMode, selectionDisabled = false }: ImageCardProps) {
  const isLoading = image.loading
  const isFailed = !image.loading && !image.url

  return (
    <div
      onClick={() => selectionMode && !selectionDisabled && !isLoading && onToggleSelect()}
      className={`relative group rounded-2xl overflow-hidden bg-zinc-800 cursor-pointer transition-all duration-200 ${
        selectionMode && !selectionDisabled && !isLoading ? 'hover:scale-[1.02]' : ''
      } ${
        selectionMode && selectionDisabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${image.selected ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-zinc-900' : ''}`}
    >
      {isLoading ? (
        <div className="aspect-square w-full animate-pulse bg-zinc-700 flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-zinc-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : isFailed ? (
        <div className="aspect-square w-full bg-zinc-800 flex flex-col items-center justify-center gap-2 text-zinc-500">
          <svg className="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span className="text-xs">Failed</span>
        </div>
      ) : (
        <img
          src={image.url}
          alt={image.prompt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* Hover overlay */}
      {selectionMode && !isLoading && (
        <div
          className={`absolute inset-0 transition-colors duration-200 ${
            image.selected ? 'bg-violet-600/20' : 'bg-transparent group-hover:bg-zinc-900/30'
          }`}
        />
      )}

      {/* Selection checkbox */}
      {selectionMode && !isLoading && (
        <div
          className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
            image.selected
              ? 'bg-violet-600 border-violet-600'
              : 'bg-zinc-900/60 border-zinc-400 group-hover:border-violet-400'
          }`}
        >
          {image.selected && (
            <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

      {/* Download button (always visible on hover when not in selection mode) */}
      {!selectionMode && !isLoading && !isFailed && (
        <div className="absolute inset-0 flex items-end justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={image.url}
            download={`image-${image.id}.png`}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900/80 hover:bg-zinc-800 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download
          </a>
        </div>
      )}
    </div>
  )
}
