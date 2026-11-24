import type { Card } from '../../workspace/types'
import { formatCost } from '../../lib/money'
import { cardCost } from '../../workspace/cost'
import { cssAspectRatio } from '../../lib/aspectRatio'
import { StoredImage } from './StoredImage'

interface CardTileProps {
  card: Card
  ratio: string
  canGenerate: boolean
  onGenerate: () => void
  onChoose: (variantId: string) => void
  onUpdate: (patch: Partial<Pick<Card, 'title' | 'number' | 'prompt'>>) => void
  onRemove: () => void
}

const INPUT = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500'

export function CardTile({ card, ratio, canGenerate, onGenerate, onChoose, onUpdate, onRemove }: CardTileProps) {
  const chosen = card.variants.find((v) => v.id === card.chosenVariantId)
  const isGenerating = card.status === 'generating'
  const cost = formatCost(cardCost(card))

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
      <div className="relative rounded-lg overflow-hidden bg-zinc-800" style={{ aspectRatio: cssAspectRatio(ratio) }}>
        {chosen ? (
          <StoredImage imageId={chosen.imageId} alt={card.title} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600">No image yet</div>
        )}
        {isGenerating && (
          <div className="absolute inset-0 bg-zinc-950/60 flex items-center justify-center text-xs text-violet-300">
            Generating…
          </div>
        )}
      </div>

      {card.variants.length > 1 && (
        <div className="flex gap-1 overflow-x-auto" role="listbox" aria-label={`Variants of ${card.title}`}>
          {card.variants.map((variant, index) => (
            <button
              key={variant.id}
              type="button"
              role="option"
              aria-selected={variant.id === card.chosenVariantId}
              aria-label={`Variant ${index + 1}`}
              onClick={() => onChoose(variant.id)}
              className={`w-10 flex-shrink-0 rounded overflow-hidden border-2 ${
                variant.id === card.chosenVariantId ? 'border-violet-500' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              style={{ aspectRatio: cssAspectRatio(ratio) }}
            >
              <StoredImage imageId={variant.imageId} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          value={card.number}
          onChange={(e) => onUpdate({ number: e.target.value })}
          placeholder="#"
          aria-label="Card number"
          className={`${INPUT} w-12 flex-shrink-0 font-mono`}
        />
        <input
          value={card.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Title"
          aria-label="Card title"
          className={`${INPUT} font-semibold`}
        />
      </div>
      <textarea
        value={card.prompt}
        onChange={(e) => onUpdate({ prompt: e.target.value })}
        rows={3}
        placeholder="What this card shows"
        aria-label="Card prompt"
        className={`${INPUT} resize-none`}
      />

      {card.status === 'error' && card.error && <p className="text-[11px] text-red-400 break-words">{card.error}</p>}

      <div className="flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold py-1.5 rounded-lg transition-colors"
        >
          {card.variants.length > 0 ? 'Regenerate' : 'Generate'}
        </button>
        {cost && <span className="text-[11px] text-zinc-500 font-mono">{cost}</span>}
        <button
          type="button"
          onClick={onRemove}
          disabled={isGenerating}
          aria-label={`Remove ${card.title}`}
          className="text-zinc-500 hover:text-red-400 disabled:opacity-40 text-xs px-1.5"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
