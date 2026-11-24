import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ChatModel } from './catalogue'
import { buildPickerGroups, describeChoice, selectableModels } from './pickerRows'

interface ChatModelPickerProps {
  value: string
  onChange: (id: string) => void
  catalogue: ChatModel[]
  loading: boolean
  error: string | null
}

export function ChatModelPicker({ value, onChange, catalogue, loading, error }: ChatModelPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)
  const selectable = useMemo(() => selectableModels(catalogue), [catalogue])
  const groups = useMemo(() => buildPickerGroups(catalogue, selectable, query), [catalogue, selectable, query])
  const rows = groups.flatMap((group) => group.rows)
  const navigable = open && !loading && !error
  const hint = describeChoice(value, catalogue)

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  function pick(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (!navigable || rows.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((current) => (current + step + rows.length) % rows.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (navigable && highlight >= 0 && rows[highlight]) pick(rows[highlight].id)
      else setOpen(false)
    }
  }

  let index = -1
  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls="chat-model-list"
        aria-activedescendant={navigable && highlight >= 0 ? `chat-model-${highlight}` : undefined}
        aria-label="Chat model"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setQuery(e.target.value)
          setHighlight(-1)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          setHighlight(-1)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKey}
        spellCheck={false}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-violet-500"
      />
      {!open && (
        <p className={`text-[10px] mt-1 truncate ${hint.tone === 'warning' ? 'text-amber-400' : 'text-zinc-500'}`}>{hint.text}</p>
      )}
      {open && (
        <ul
          id="chat-model-list"
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl"
        >
          {loading && <li className="px-3 py-2 text-xs text-zinc-500">Loading models…</li>}
          {error && <li className="px-3 py-2 text-xs text-amber-400">{error} — you can still type a model id.</li>}
          {navigable &&
            groups.map((group) => (
              <li key={group.title} role="presentation">
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-zinc-500">{group.title}</div>
                <ul role="presentation">
                  {group.rows.map((row) => {
                    index += 1
                    const rowIndex = index
                    return (
                      <li
                        key={`${group.title}-${row.id}`}
                        id={`chat-model-${rowIndex}`}
                        data-index={rowIndex}
                        role="option"
                        aria-selected={row.id === value}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          pick(row.id)
                        }}
                        onMouseEnter={() => setHighlight(rowIndex)}
                        className={`px-3 py-1.5 cursor-pointer ${rowIndex === highlight ? 'bg-zinc-800' : ''}`}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span className="min-w-0 truncate font-mono text-zinc-200">{row.id}</span>
                          {row.badge && (
                            <span className="shrink-0 text-[9px] px-1 rounded border border-violet-500/30 text-violet-300">
                              {row.badge}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 text-[10px] text-zinc-500">{row.meta}</span>
                        </div>
                        {row.detail && <div className="text-[10px] text-zinc-500 truncate">{row.detail}</div>}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          {navigable && rows.length === 0 && <li className="px-3 py-2 text-xs text-zinc-500">No match — the typed id is used as is.</li>}
        </ul>
      )}
    </div>
  )
}
