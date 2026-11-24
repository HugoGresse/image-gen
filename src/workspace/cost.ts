import { sumCosts } from '../lib/openrouter'
import type { Card, Project } from './types'

export function cardCost(card: Card): number | null {
  return sumCosts(card.variants.map((variant) => variant.cost))
}

export function projectCost(project: Project): number | null {
  return sumCosts(project.cards.map(cardCost))
}
