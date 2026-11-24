import { useState } from 'react'
import type { Project } from '../../workspace/types'
import { parseCardList } from '../../workspace/prompt'
import { useWorkspace } from '../../workspace/workspaceContext'
import { CardTile } from './CardTile'

interface CardBoardProps {
  project: Project
  canGenerate: boolean
}

export function CardBoard({ project, canGenerate }: CardBoardProps) {
  const { actions } = useWorkspace()
  const [draft, setDraft] = useState('')
  const parsed = parseCardList(draft)

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
        <div className="flex justify-end mt-2">
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

      {project.cards.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-10">No items yet. Add some above, or ask the assistant.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {project.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              ratio={project.settings.ratio}
              canGenerate={canGenerate}
              onGenerate={() => actions.generateCard(project.id, card.id)}
              onChoose={(variantId) => actions.chooseVariant(project.id, card.id, variantId)}
              onUpdate={(patch) => actions.updateCard(project.id, card.id, patch)}
              onRemove={() => actions.removeCard(project.id, card.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
