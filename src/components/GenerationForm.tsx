import { useState } from 'react'
import type { AspectRatio, GenerationParams } from '../types'
import { IMAGE_MODELS } from '../lib/openrouter'

const RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']

interface GenerationFormProps {
  onGenerate: (params: GenerationParams) => void
  isLoading: boolean
}

export function GenerationForm({ onGenerate, isLoading }: GenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(4)
  const [ratio, setRatio] = useState<AspectRatio>('1:1')
  const [model, setModel] = useState(IMAGE_MODELS[0].id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || isLoading) return
    onGenerate({ prompt: prompt.trim(), count, ratio, model })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic photo of a futuristic city at night, neon reflections on wet streets..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none transition-colors"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Count */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Images to generate: <span className="text-violet-400 font-semibold">{count}</span>
          </label>
          <input
            type="range"
            min={1}
            max={8}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-violet-500 mt-1.5"
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>1</span>
            <span>8</span>
          </div>
        </div>

        {/* Ratio */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
          <div className="flex flex-wrap gap-1.5">
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                  ratio === r
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-violet-500 hover:text-violet-400'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!prompt.trim() || isLoading}
        className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Generating…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Generate {count} Image{count !== 1 ? 's' : ''}
          </>
        )}
      </button>
    </form>
  )
}
