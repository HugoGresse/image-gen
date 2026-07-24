import type { ImageModel } from '../lib/openrouter'
import { acceptsAttachments } from '../lib/modelInfo'

const TONES = {
  sky: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  rose: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  zinc: 'bg-zinc-800 text-zinc-500 border-zinc-700',
} as const

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: string }) {
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TONES[tone]}`}>{children}</span>
}

/** What the model accepts as input, so attachments can be matched to it at a glance. */
export function CapabilityBadges({ model }: { model: ImageModel }) {
  return (
    <>
      {model.supportsImageInput && <Badge tone="sky">Image input</Badge>}
      {model.supportsFileInput && <Badge tone="rose">PDF input</Badge>}
      {!acceptsAttachments(model) && <Badge tone="zinc">Text prompt only</Badge>}
    </>
  )
}
