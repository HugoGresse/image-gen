import { useState } from 'react'
import type { Project } from '../../workspace/types'
import { parseCardList } from '../../workspace/prompt'
import { estimateBatchCost } from '../../workspace/cost'
import { queueCounts } from '../../workspace/reducer'
import { formatCost } from '../../lib/money'
import { useWorkspace } from '../../workspace/workspaceContext'
import { findModel, useImageModels } from '../../models/modelsContext'
import { CardTile } from './CardTile'
import { projectFrame } from '../../workspace/frame'
import { PRESETS, isPresetId, missingPresetCards } from '../../workspace/presets'

interface CardBoardProps {
  project: Project
  canGenerate: boolean
}

export function CardBoard({ project, canGenerate }: CardBoardProps) {
  const { actions } = useWorkspace()
  const [draft, setDraft] = useState('')
  const parsed = parseCardList(draft)

  const missing = project.cards.filter((card) => card.variants.length === 0 && (card.status === 'idle' || card.status === 'error'))
  const { queued, generating } = queueCounts(project)
  const { models } = useImageModels()
  const frame = projectFrame(project)
  const model = findModel(models, project.settings.modelId)
  const anchorCount = project.cards.filter((card) => card.anchor).length
  const referenceOverflow = model !== undefined && anchorCount > 0 && project.referenceIds.length + anchorCount > model.maxReferenceImages

  function handleGenerateMissing() {
    const images = missing.length * project.settings.variantsPerCard
    const estimate = formatCost(estimateBatchCost(project, missing.length))
    const message = `Generate ${missing.length} items (${images} images) with ${project.settings.modelId}?${
      estimate ? `\nEstimated cost ≈ ${estimate}.` : '\nNo estimate yet: nothing was generated in this project.'
    }`
    if (window.confirm(message)) actions.queueCards(project.id, missing.map((card) => card.id))
  }

  function handleAdd() {
    if (parsed.length === 0) return
    actions.addCards(project.id, parsed)
    setDraft('')
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Add items — one per line: <code className="text-zinc-300">title | prompt</code> or{' '}
          <code className="text-zinc-300">number | title | prompt</code>
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={'0 | The Fool | A young traveller at the edge of a cliff, a small dog at his heels\nI | The Magician | A figure raising a wand, tools of the four suits on the table'}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 resize-y font-mono"
        />
        <div className="flex justify-end items-center gap-2 mt-2">
          <select
            value=""
            onChange={(e) => {
              if (!isPresetId(e.target.value)) return
              const cards = missingPresetCards(e.target.value, project.cards.map((card) => card.title))
              if (cards.length > 0) actions.addCards(project.id, cards)
            }}
            aria-label="Add a preset list"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="">Add a preset…</option>
            {Object.entries(PRESETS).map(([id, preset]) => (
              <option key={id} value={id}>
                {preset.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAdd}
            disabled={parsed.length === 0}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
          >
            Add {parsed.length || ''} item{parsed.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>

      {project.cards.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <button
            type="button"
            onClick={handleGenerateMissing}
            disabled={!canGenerate || missing.length === 0}
            className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-semibold px-3 py-1.5 rounded-lg"
          >
            Generate missing ({missing.length})
          </button>
          {(queued > 0 || generating > 0) && (
            <span className="text-zinc-400">
              {generating} generating · {queued} queued
            </span>
          )}
          {queued > 0 && (
            <button type="button" onClick={() => actions.cancelQueue(project.id)} className="text-zinc-400 hover:text-white underline">
              Cancel queue
            </button>
          )}
          <span className="text-zinc-600 ml-auto">★ marks anchors: their image guides every other item.</span>
          {referenceOverflow && model && (
            <span className="w-full text-amber-400">
              {model.label} accepts {model.maxReferenceImages} reference image{model.maxReferenceImages === 1 ? '' : 's'}: with{' '}
              {project.referenceIds.length} style references and {anchorCount} anchors, some are left out (anchors keep at least half
              of the slots).
            </span>
          )}
        </div>
      )}

      {project.cards.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-10">No items yet. Add some above, or ask the assistant.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {project.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              ratio={project.settings.ratio}
              frame={frame}
              canGenerate={canGenerate}
              onGenerate={() => actions.queueCards(project.id, [card.id])}
              onChoose={(variantId) => actions.chooseVariant(project.id, card.id, variantId)}
              onUpdate={(patch) => actions.updateCard(project.id, card.id, patch)}
              onRemove={() => actions.removeCard(project.id, card.id)}
              onToggleAnchor={() => actions.setAnchor(project.id, card.id, !card.anchor)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
