import { useState, useEffect } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import type { AspectRatio, GenerationParams, ImageModel } from '../types'
import { FALLBACK_RATIOS } from '../types'
import { fetchImageModels, unsupportedAttachmentKinds } from '../lib/openrouter'
import { formatReferenceSupport } from '../lib/modelInfo'
import { planBatches } from '../lib/imageRequest'
import { AttachmentPicker } from './AttachmentPicker'
import { ModelSelect } from './ModelSelect'
import { useAttachments } from '../hooks/useAttachments'

interface GenerationFormProps {
  onGenerate: (params: GenerationParams) => void
  isLoading: boolean
}

export function GenerationForm({ onGenerate, isLoading }: GenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [count, setCount] = useState(4)
  const [ratio, setRatio] = useState<AspectRatio>('1:1')
  const [models, setModels] = useState<ImageModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const { attachments, errors: attachmentErrors, isReading, addFiles, removeAttachment } = useAttachments()

  useEffect(() => {
    fetchImageModels()
      .then((fetched) => {
        if (fetched.length === 0) {
          setModelsError('No image generation models available.')
          return
        }
        setModels(fetched)
        setModel(fetched[0].id)
      })
      .catch((err: unknown) => {
        setModelsError(err instanceof Error ? err.message : 'Failed to load models.')
      })
      .finally(() => setLoadingModels(false))
  }, [])

  const selectedModel = models.find((m) => m.id === model)
  const ratios = selectedModel?.aspectRatios ?? (selectedModel ? null : FALLBACK_RATIOS)
  const unsupported = unsupportedAttachmentKinds(attachments, selectedModel)
  const requestCount = selectedModel ? planBatches(count, selectedModel.maxImagesPerRequest).length : 1
  // Ratios are declared per model, so fall back to one the selected model accepts.
  const effectiveRatio = ratios && ratios.length > 0 && !ratios.includes(ratio) ? ratios[0] : ratio

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!prompt.trim() || isLoading || !selectedModel) return
    onGenerate({ prompt: prompt.trim(), count, ratio: effectiveRatio, model: selectedModel, attachments })
  }

  /** Pasting a screenshot or file into the prompt attaches it instead of inserting text. */
  function handlePaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files)
    if (files.length === 0) return
    e.preventDefault()
    addFiles(files)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Prompt */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onPaste={handlePaste}
          placeholder="A cinematic photo of a futuristic city at night, neon reflections on wet streets..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-none transition-colors"
        />
      </div>

      {/* Attachments */}
      <AttachmentPicker
        attachments={attachments}
        errors={attachmentErrors}
        isReading={isReading}
        disabled={isLoading}
        onAddFiles={addFiles}
        onRemove={removeAttachment}
      />

      {unsupported.length > 0 && (
        <p className="text-xs text-amber-400 -mt-3">
          {unsupported.includes('pdf') && 'PDFs cannot be sent to the image API — attach a text document instead. '}
          {unsupported.includes('image') && (
            <>
              {selectedModel?.label} takes no reference images. Pick a model from the{' '}
              <span className="text-amber-300">Accepts reference images</span> group, or remove them.
            </>
          )}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Model</label>
          <ModelSelect
            models={models}
            value={model}
            onChange={setModel}
            loading={loadingModels}
            error={modelsError}
          />
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
          {selectedModel && (
            <p className="text-[11px] text-zinc-600 mt-1">
              {requestCount === 1 ? '1 request' : `${requestCount} requests`} ·{' '}
              {formatReferenceSupport(selectedModel.maxReferenceImages).toLowerCase()}
            </p>
          )}
        </div>

        {/* Ratio */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
          {ratios ? (
            <div className="flex flex-wrap gap-1.5">
              {ratios.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRatio(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors ${
                    effectiveRatio === r
                      ? 'bg-violet-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-violet-500 hover:text-violet-400'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 mt-2">
              {selectedModel?.label} does not expose an aspect ratio — the provider default is used.
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!prompt.trim() || isLoading || !model}
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
