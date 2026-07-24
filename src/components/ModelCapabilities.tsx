import type { ImageModel } from '../types'
import { acceptsReferenceImages, formatReferenceSupport } from '../lib/modelInfo'

const TONES = {
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  violet: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  zinc: 'bg-zinc-800 text-zinc-500 border-zinc-700',
} as const

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: string }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TONES[tone]}`}>{children}</span>
}

/** What the model accepts as input, so attachments can be matched to it at a glance. */
export function CapabilityBadges({ model }: { model: ImageModel }) {
  return (
    <>
      <Badge tone={acceptsReferenceImages(model) ? 'sky' : 'zinc'}>
        {formatReferenceSupport(model.maxReferenceImages)}
      </Badge>
      {model.aspectRatios && <Badge tone="violet">{`${model.aspectRatios.length} ratios`}</Badge>}
    </>
  )
}
