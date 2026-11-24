import { sumCosts } from '../lib/openrouter'
import type { Card, Project } from './types'

export function cardCost(card: Card): number | null {
  return sumCosts(card.variants.map((variant) => variant.cost))
}

/** Generation plus consistency checks. */
export function projectCost(project: Project): number | null {
  return sumCosts([...project.cards.map(cardCost), ...project.cards.map((card) => card.review?.cost ?? null)])
}

/** Average billed cost of one image of this project, from what was already generated. */
export function averageImageCost(project: Project): number | null {
  const costs = project.cards.flatMap((card) => card.variants.map((variant) => variant.cost))
  const known = costs.filter((cost): cost is number => cost !== null)
  return known.length > 0 ? known.reduce((total, cost) => total + cost, 0) / known.length : null
}

export function estimateBatchCost(project: Project, cardCount: number): number | null {
  const average = averageImageCost(project)
  return average === null ? null : average * cardCount * project.settings.variantsPerCard
}
