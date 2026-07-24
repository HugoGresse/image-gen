import type { ImageModel } from '../lib/openrouter'

interface ModelSelectProps {
  models: ImageModel[]
  value: string
  onChange: (id: string) => void
  loading: boolean
  error: string | null
}

/** Short suffix shown inside the native option, which cannot render badges. */
function capabilitySuffix(model: ImageModel): string {
  if (model.supportsImageInput && model.supportsFileInput) return ' — image + PDF input'
  if (model.supportsImageInput) return ' — image input'
  if (model.supportsFileInput) return ' — PDF input'
  return ''
}

function acceptsAttachments(model: ImageModel): boolean {
  return model.supportsImageInput || model.supportsFileInput
}

function Badge({ tone, children }: { tone: 'sky' | 'rose' | 'zinc'; children: string }) {
  const tones = {
    sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    zinc: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${tones[tone]}`}>{children}</span>
}

export function ModelSelect({ models, value, onChange, loading, error }: ModelSelectProps) {
  if (error) {
    return <p className="text-xs text-red-400 mt-1">{error}</p>
  }

  const multimodal = models.filter(acceptsAttachments)
  const textOnly = models.filter((m) => !acceptsAttachments(m))
  const selected = models.find((m) => m.id === value)

  return (
    <>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-60"
      >
        {loading && <option value="">Loading models…</option>}
        {multimodal.length > 0 && (
          <optgroup label="Accepts image / PDF attachments">
            {multimodal.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
                {capabilitySuffix(m)}
              </option>
            ))}
          </optgroup>
        )}
        {textOnly.length > 0 && (
          <optgroup label="Text prompt only">
            {textOnly.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {selected && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.supportsImageInput && <Badge tone="sky">Image input</Badge>}
          {selected.supportsFileInput && <Badge tone="rose">PDF input</Badge>}
          {!acceptsAttachments(selected) && <Badge tone="zinc">Text prompt only</Badge>}
        </div>
      )}
    </>
  )
}
