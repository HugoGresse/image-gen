import type { Card, NewCard } from './types'

export function composeCardPrompt(styleGuide: string, card: Pick<Card, 'title' | 'prompt'>): string {
  const subject = card.prompt.trim() || card.title.trim()
  const style = styleGuide.trim()
  const parts = [
    style && `Art direction shared by every image in this series:\n${style}`,
    `Subject: ${subject}`,
    'Illustration only: no border, frame, caption, title or lettering — those are added afterwards.',
  ]
  return parts.filter(Boolean).join('\n\n')
}

/**
 * One card per line as `title | prompt` or `number | title | prompt`;
 * a bare line is both title and prompt.
 */
export function parseCardList(text: string): NewCard[] {
  return text
    .split('\n')
    .map((line) => line.split('|').map((part) => part.trim()))
    .map((parts): NewCard => {
      if (parts.length >= 3) return { number: parts[0], title: parts[1], prompt: parts.slice(2).join(' | ') }
      if (parts.length === 2) return { title: parts[0], prompt: parts[1] }
      return { title: parts[0], prompt: parts[0] }
    })
    .filter((card) => card.title || card.prompt)
    .map((card) => ({ ...card, title: card.title || card.prompt }))
}
