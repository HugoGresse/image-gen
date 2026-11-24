import { useStoredImageUrl } from '../../hooks/useStoredImageUrl'
import { framedSvgMarkup } from '../../workspace/frame'
import type { FrameSettings } from '../../workspace/frame'
import type { Card } from '../../workspace/types'

interface FramedCardProps {
  card: Pick<Card, 'title' | 'number'>
  imageId: string | undefined
  ratio: string
  frame: FrameSettings
}

/** Same SVG drawing as the export, so what is on screen is what gets downloaded. */
export function FramedCard({ card, imageId, ratio, frame }: FramedCardProps) {
  const imageUrl = useStoredImageUrl(imageId)
  const markup = framedSvgMarkup(ratio, frame, card, { imageUrl, sizing: 'fluid' })
  return <div className="w-full h-full" role="img" aria-label={card.title} dangerouslySetInnerHTML={{ __html: markup }} />
}
