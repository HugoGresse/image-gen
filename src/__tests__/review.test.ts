import { describe, it, expect } from 'vitest'
import { buildReviewContent, parseReview, reviewBasisProblem, reviewReferenceIds } from '../workspace/review'
import { currentReview, initialWorkspace, workspaceReducer } from '../workspace/reducer'
import type { WorkspaceAction } from '../workspace/reducer'
import { mapPool } from '../lib/pool'
import { visionModelId } from '../chat/catalogue'
import type { ChatModel } from '../chat/catalogue'
import type { Project } from '../workspace/types'

describe('parseReview', () => {
  it('reads JSON wrapped in prose or fences and clamps the score', () => {
    expect(parseReview('```json\n{"score": 4, "issues": " warmer palette "}\n```')).toEqual({ score: 4, issues: 'warmer palette' })
    expect(parseReview('{"score": 9}')).toEqual({ score: 5, issues: '' })
    expect(parseReview('{"score": "2.4", "issues": 3}')).toEqual({ score: 2, issues: '' })
  })

  it('fails clearly without a score', () => {
    expect(() => parseReview('Looks great!')).toThrow('did not return a score')
    expect(() => parseReview('{"issues": "x"}')).toThrow('no numeric score')
    expect(() => parseReview(null)).toThrow()
  })
})

describe('buildReviewContent', () => {
  it('sends the style, the references, then the image to check last', () => {
    const parts = buildReviewContent('gold engraving', ['ref1', 'ref2'], 'item', { title: 'The Fool' })
    const images = parts.flatMap((p) => (p.type === 'image_url' ? [p.image_url.url] : []))
    expect(images).toEqual(['ref1', 'ref2', 'item'])
    expect(parts[0]).toEqual({ type: 'text', text: 'Art direction:\ngold engraving' })
  })
})

const variant = (id: string) => ({ id, imageId: `img-${id}`, createdAt: 1, cost: null })
const actions: WorkspaceAction[] = [
  { type: 'createProject', id: 'p', name: 'P', settings: { modelId: 'm', ratio: '2:3', variantsPerCard: 2 }, now: 1 },
  { type: 'addCards', id: 'p', cards: [{ id: 'a', title: 'A', prompt: 'a' }, { id: 'b', title: 'B', prompt: 'b' }], now: 1 },
  { type: 'generationFinished', id: 'p', cardId: 'a', variants: [variant('a1'), variant('a2')], now: 2 },
  { type: 'generationFinished', id: 'p', cardId: 'b', variants: [variant('b1')], now: 2 },
  { type: 'setAnchor', id: 'p', cardId: 'b', anchor: true, now: 3 },
  { type: 'addReferences', id: 'p', imageIds: ['r1', 'r2', 'r3'], now: 3 },
]
const state = actions.reduce(workspaceReducer, { ...initialWorkspace, loaded: true })
const project: Project = state.projects[0]

describe('reviews', () => {
  it('needs a style guide, references or a generated anchor to compare with', () => {
    expect(reviewBasisProblem(project)).toBeNull()
    const bare = { ...project, referenceIds: [], cards: project.cards.map((c) => ({ ...c, anchor: false })) }
    expect(reviewBasisProblem(bare)).toContain('nothing to compare with')
    expect(reviewBasisProblem({ ...bare, styleGuide: 'ink' })).toBeNull()
  })

  it('compares with anchors first, then style references, three at most', () => {
    expect(reviewReferenceIds(project, 'a')).toEqual(['img-b1', 'r1', 'r2'])
  })

  it('stops applying once another variant is chosen', () => {
    const review = { score: 2, issues: 'too dark', imageId: 'img-a1', model: 'm', cost: null, reviewedAt: 1 }
    const steps: WorkspaceAction[] = [
      { type: 'reviewStarted', id: 'p', cardIds: ['a'] },
      { type: 'reviewFinished', id: 'p', cardId: 'a', review, now: 4 },
    ]
    const reviewed = steps.reduce(workspaceReducer, state)
    const card = reviewed.projects[0].cards[0]
    expect(card.reviewing).toBe(false)
    expect(currentReview(card)).toEqual(review)
    const switched = workspaceReducer(reviewed, { type: 'chooseVariant', id: 'p', cardId: 'a', variantId: 'a2', now: 5 })
    expect(currentReview(switched.projects[0].cards[0])).toBeUndefined()
  })

  it('keeps the previous review when a new check fails', () => {
    const review = { score: 5, issues: '', imageId: 'img-a1', model: 'm', cost: null, reviewedAt: 1 }
    const steps: WorkspaceAction[] = [
      { type: 'reviewFinished', id: 'p', cardId: 'a', review, now: 4 },
      { type: 'reviewStarted', id: 'p', cardIds: ['a'] },
      { type: 'reviewFinished', id: 'p', cardId: 'a', error: 'timeout', now: 5 },
    ]
    const failed = steps.reduce(workspaceReducer, state)
    expect(failed.projects[0].cards[0]).toMatchObject({ review, reviewError: 'timeout', reviewing: false })
  })
})

describe('mapPool', () => {
  it('limits concurrency, keeps order and settles every item', async () => {
    let running = 0
    let peak = 0
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      if (n === 3) throw new Error('three')
      return n * 10
    })
    expect(peak).toBe(2)
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : 'x'))).toEqual([10, 20, 'x', 40, 50])
    expect(await mapPool([], 2, async () => 1)).toEqual([])
  })
})

describe('visionModelId', () => {
  const model = (id: string, acceptsImages: boolean): ChatModel => ({
    id,
    name: id,
    author: id.split('/')[0],
    created: null,
    contextLength: null,
    promptPriceUsd: 0,
    completionPriceUsd: 0,
    priceVaries: false,
    isAlias: false,
    acceptsImages,
  })

  it('falls back to the router when the chat model cannot read images', () => {
    const catalogue = [model('a/text-only', false), model('a/vision', true)]
    expect(visionModelId('a/text-only', catalogue)).toBe('openrouter/auto')
    expect(visionModelId('a/vision', catalogue)).toBe('a/vision')
    expect(visionModelId('a/unknown', catalogue)).toBe('openrouter/auto')
    expect(visionModelId('openrouter/free', catalogue)).toBe('openrouter/free')
  })
})
