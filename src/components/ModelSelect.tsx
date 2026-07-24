import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ImageModel } from '../types'
import { acceptsReferenceImages, isRecentRelease, modelMetaParts, summarizeDescription } from '../lib/modelInfo'
import { CapabilityBadges } from './ModelCapabilities'

interface ModelSelectProps {
  models: ImageModel[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  error: string | null
}

interface Section {
  title: string
  /** Items carry their position in the flattened list so keyboard nav can cross sections. */
  items: { model: ImageModel; index: number }[]
}

function buildSections(models: ImageModel[], query: string): Section[] {
  const needle = query.trim().toLowerCase()
  const matches = models.filter(
    (m) => !needle || m.label.toLowerCase().includes(needle) || m.id.toLowerCase().includes(needle)
  )
  const groups = [
    { title: 'Accepts reference images', models: matches.filter(acceptsReferenceImages) },
    { title: 'Text prompt only', models: matches.filter((m) => !acceptsReferenceImages(m)) },
  ].filter((group) => group.models.length > 0)

  let index = 0
  return groups.map((group) => ({
    title: group.title,
    items: group.models.map((model) => ({ model, index: index++ })),
  }))
}

function ModelRow({
  model,
  isSelected,
  isHighlighted,
  index,
  now,
  onPick,
  onHover,
}: {
  model: ImageModel
  isSelected: boolean
  isHighlighted: boolean
  index: number
  now: number
  onPick: () => void
  onHover: () => void
}) {
  return (
    <li
      role="option"
      aria-selected={isSelected}
      data-index={index}
      onMouseEnter={onHover}
      onClick={onPick}
      className={`px-3 py-2.5 cursor-pointer border-l-2 transition-colors ${
        isHighlighted ? 'bg-zinc-800 border-violet-500' : 'border-transparent hover:bg-zinc-800/60'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm truncate ${isSelected ? 'text-violet-300 font-medium' : 'text-white'}`}>
          {model.label}
        </span>
        {isRecentRelease(model.createdAt, now) && (
          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-violet-500/10 text-violet-300 border-violet-500/30 flex-shrink-0">
            New
          </span>
        )}
        {isSelected && (
          <svg
            className="w-3.5 h-3.5 text-violet-400 ml-auto flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <CapabilityBadges model={model} />
        <span className="text-[11px] text-zinc-500 font-mono">{modelMetaParts(model).join(' · ')}</span>
      </div>

      {model.description && (
        <p className="text-[11px] text-zinc-600 mt-1 line-clamp-1">{summarizeDescription(model.description)}</p>
      )}
    </li>
  )
}

export function ModelSelect({ models, value, onChange, loading, error }: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [now, setNow] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const sections = useMemo(() => buildSections(models, query), [models, query])
  const flat = useMemo(() => sections.flatMap((s) => s.items.map((item) => item.model)), [sections])
  const selected = models.find((m) => m.id === value)

  useEffect(() => {
    if (!isOpen) return
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, isOpen])

  function open() {
    setQuery('')
    setHighlight(Math.max(models.findIndex((m) => m.id === value), 0))
    // Sampled on open so the "New" badges stay stable while the list is up.
    setNow(Date.now())
    setIsOpen(true)
  }

  function pick(id: string) {
    onChange(id)
    setIsOpen(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault()
      open()
      return
    }
    if (!isOpen) return

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((prev) => (flat.length === 0 ? 0 : (prev + step + flat.length) % flat.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const model = flat[highlight]
      if (model) pick(model.id)
    }
  }

  if (error) {
    return <p className="text-xs text-red-400 mt-1">{error}</p>
  }

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={loading}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-left focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-60"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">
            {loading ? 'Loading models…' : (selected?.label ?? 'Select a model')}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-500 ml-auto flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {selected && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <CapabilityBadges model={selected} />
            <span className="text-[11px] text-zinc-500 font-mono">{modelMetaParts(selected).join(' · ')}</span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-[min(30rem,calc(100vw-3rem))] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-zinc-800">
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setHighlight(0)
              }}
              placeholder="Search models…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
            />
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto">
            {flat.length === 0 && <p className="px-3 py-6 text-sm text-zinc-500 text-center">No model matches.</p>}
            {sections.map((section) => (
              <div key={section.title}>
                <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-950 border-b border-zinc-800 sticky top-0 z-10">
                  {section.title}
                </p>
                <ul role="listbox" aria-label={section.title}>
                  {section.items.map(({ model, index }) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      index={index}
                      now={now}
                      isSelected={model.id === value}
                      isHighlighted={index === highlight}
                      onHover={() => setHighlight(index)}
                      onPick={() => pick(model.id)}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
