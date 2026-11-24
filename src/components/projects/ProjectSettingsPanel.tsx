import { useRef } from 'react'
import type { Project } from '../../workspace/types'
import { findModel, useImageModels } from '../../models/modelsContext'
import { isVectorOnly, supportsVector, VECTOR_FORMAT } from '../../lib/outputFormat'
import { MAX_VARIANTS_PER_CARD } from '../../workspace/reducer'
import { useWorkspace } from '../../workspace/workspaceContext'
import { ModelSelect } from '../ModelSelect'
import { StoredImage } from './StoredImage'

const LABEL = 'block text-xs font-medium text-zinc-400 mb-1.5'
const PILL = 'px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-colors'
const PILL_ON = 'bg-violet-600 text-white'
const PILL_OFF = 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-violet-500 hover:text-violet-400'

export function ProjectSettingsPanel({ project }: { project: Project }) {
  const { actions } = useWorkspace()
  const { models, loading, error } = useImageModels()
  const fileInput = useRef<HTMLInputElement>(null)
  const model = findModel(models, project.settings.modelId)
  const ratios = model?.aspectRatios ?? []
  const vectorChoice = model && supportsVector(model) && !isVectorOnly(model)
  const update = (settings: Partial<Project['settings']>) => actions.updateSettings(project.id, settings)

  function handleModelChange(modelId: string) {
    const next = findModel(models, modelId)
    const nextRatios = next?.aspectRatios ?? []
    update({
      modelId,
      ratio: nextRatios.length === 0 || nextRatios.includes(project.settings.ratio) ? project.settings.ratio : nextRatios[0],
      outputFormat: next && isVectorOnly(next) ? VECTOR_FORMAT : undefined,
    })
  }

  async function handleFiles(files: FileList | null) {
    const images = Array.from(files ?? []).filter((file) => file.type.startsWith('image/'))
    if (images.length > 0) await actions.addReferenceFiles(project.id, images)
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>Project name</label>
          <input
            value={project.name}
            onChange={(e) => actions.renameProject(project.id, e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
          />
        </div>
        <div>
          <label className={LABEL}>Model (fixed for the whole series)</label>
          <ModelSelect models={models} value={project.settings.modelId} onChange={handleModelChange} loading={loading} error={error} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div>
          <label className={LABEL}>Ratio</label>
          {ratios.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-w-md">
              {ratios.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  aria-pressed={project.settings.ratio === ratio}
                  onClick={() => update({ ratio })}
                  className={`${PILL} ${project.settings.ratio === ratio ? PILL_ON : PILL_OFF}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Provider default</p>
          )}
        </div>
        <div>
          <label className={LABEL}>Variants per card</label>
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_VARIANTS_PER_CARD }, (_, i) => i + 1).map((count) => (
              <button
                key={count}
                type="button"
                aria-pressed={project.settings.variantsPerCard === count}
                onClick={() => update({ variantsPerCard: count })}
                className={`${PILL} ${project.settings.variantsPerCard === count ? PILL_ON : PILL_OFF}`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        {vectorChoice && (
          <div>
            <label className={LABEL}>Output</label>
            <div className="flex gap-1.5">
              {[undefined, VECTOR_FORMAT].map((format) => (
                <button
                  key={format ?? 'raster'}
                  type="button"
                  aria-pressed={project.settings.outputFormat === format}
                  onClick={() => update({ outputFormat: format })}
                  className={`${PILL} ${project.settings.outputFormat === format ? PILL_ON : PILL_OFF}`}
                >
                  {format ? 'SVG' : 'Raster'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className={LABEL}>Style guide — added to every card prompt</label>
        <textarea
          value={project.styleGuide}
          onChange={(e) => actions.updateStyleGuide(project.id, e.target.value)}
          rows={4}
          placeholder="Palette, technique, line work, lighting, era, mood… e.g. Art nouveau engraving, gold and deep indigo, fine hatching, symmetrical composition."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 resize-y"
        />
      </div>

      <div>
        <label className={LABEL}>
          Style references — sent with every card
          {model && ` (model accepts ${model.maxReferenceImages})`}
        </label>
        <div className="flex flex-wrap gap-2">
          {project.referenceIds.map((imageId) => (
            <div key={imageId} className="relative w-16 h-16 rounded-lg overflow-hidden group">
              <StoredImage imageId={imageId} alt="Style reference" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => actions.removeReference(project.id, imageId)}
                aria-label="Remove reference"
                className="absolute top-0.5 right-0.5 bg-zinc-900/80 text-white text-[10px] w-5 h-5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-16 h-16 rounded-lg border border-dashed border-zinc-700 text-zinc-500 hover:border-violet-500 hover:text-violet-400 text-xl"
            aria-label="Add style references"
          >
            +
          </button>
          <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        </div>
      </div>
    </div>
  )
}
