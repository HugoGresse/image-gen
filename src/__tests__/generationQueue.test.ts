import { describe, it, expect, vi } from 'vitest'
import { anchorImageIds, initialWorkspace, nextToStart, queueCounts, workspaceReducer } from '../workspace/reducer'
import type { WorkspaceAction } from '../workspace/reducer'
import { isTransientError, pickReferences, withRetry } from '../workspace/generateCard'
import { reconcileSettings } from '../workspace/settings'
import type { ImageModel } from '../types'

const SETTINGS = { modelId: 'm', ratio: '2:3', variantsPerCard: 1 }
const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id, title: id, prompt: id }))
const base = [
  { type: 'createProject', id: 'p', name: 'P', settings: SETTINGS, now: 1 },
  { type: 'addCards', id: 'p', cards, now: 1 },
] as WorkspaceAction[]
const run = (actions: WorkspaceAction[]) => [...base, ...actions].reduce(workspaceReducer, { ...initialWorkspace, loaded: true })

describe('generation queue', () => {
  it('starts queued items up to the concurrency, counting running ones', () => {
    const state = run([
      { type: 'queueCards', id: 'p', cardIds: ['a', 'b', 'c'] },
      { type: 'generationStarted', id: 'p', cardId: 'a' },
    ])
    expect(nextToStart(state, 2)).toEqual([{ projectId: 'p', cardId: 'b' }])
    expect(queueCounts(state.projects[0])).toEqual({ queued: 2, generating: 1 })
  })

  it('cancels only queued items and never re-queues running ones', () => {
    const state = run([
      { type: 'generationStarted', id: 'p', cardId: 'a' },
      { type: 'queueCards', id: 'p', cardIds: ['a', 'b'] },
      { type: 'cancelQueue', id: 'p' },
    ])
    expect(state.projects[0].cards.map((c) => c.status)).toEqual(['generating', 'idle', 'idle', 'idle'])
  })

  it('does not resume a queue after reload', () => {
    const queued = run([{ type: 'queueCards', id: 'p', cardIds: ['a'] }])
    const reloaded = workspaceReducer(initialWorkspace, { type: 'loaded', projects: queued.projects })
    expect(nextToStart(reloaded, 2)).toEqual([])
  })

  it('lends the chosen image of other anchors only', () => {
    const variant = (id: string) => ({ id, imageId: `img-${id}`, createdAt: 1, cost: null })
    const state = run([
      { type: 'generationFinished', id: 'p', cardId: 'a', variants: [variant('a1'), variant('a2')], now: 2 },
      { type: 'chooseVariant', id: 'p', cardId: 'a', variantId: 'a2', now: 3 },
      { type: 'generationFinished', id: 'p', cardId: 'b', variants: [variant('b1')], now: 2 },
      { type: 'setAnchor', id: 'p', cardId: 'a', anchor: true, now: 4 },
      { type: 'setAnchor', id: 'p', cardId: 'b', anchor: true, now: 4 },
      { type: 'setAnchor', id: 'p', cardId: 'c', anchor: true, now: 4 },
    ])
    expect(anchorImageIds(state.projects[0], 'd')).toEqual(['img-a2', 'img-b1'])
    expect(anchorImageIds(state.projects[0], 'a')).toEqual(['img-b1'])
  })
})

describe('isTransientError', () => {
  it('retries throttling and provider failures only', () => {
    expect(isTransientError('OpenRouter error 429: rate limited')).toBe(true)
    expect(isTransientError('OpenRouter error 503: overloaded')).toBe(true)
    expect(isTransientError('TypeError: Failed to fetch')).toBe(true)
    expect(isTransientError('OpenRouter error 400: invalid output_format')).toBe(false)
    expect(isTransientError('OpenRouter error 400: prompt longer than 500 characters')).toBe(false)
    expect(isTransientError(undefined)).toBe(false)
  })
})

describe('reconcileSettings', () => {
  const model = (overrides: Partial<ImageModel>): ImageModel => ({
    id: 'x',
    label: 'x',
    description: '',
    createdAt: null,
    aspectRatios: ['1:1', '16:9'],
    resolutions: null,
    maxImagesPerRequest: 1,
    maxReferenceImages: 0,
    outputFormats: ['png'],
    imageOutputPrice: null,
    ...overrides,
  })

  it('moves an unsupported ratio and drops SVG on a raster-only model', () => {
    expect(reconcileSettings({ ...SETTINGS, outputFormat: 'svg' }, model({}))).toEqual({ ...SETTINGS, ratio: '1:1', outputFormat: undefined })
  })

  it('forces SVG on vector-only models and keeps valid settings untouched', () => {
    expect(reconcileSettings(SETTINGS, model({ outputFormats: ['svg'], aspectRatios: ['2:3'] })).outputFormat).toBe('svg')
    const valid = { ...SETTINGS, ratio: '16:9' }
    expect(reconcileSettings(valid, model({}))).toBe(valid)
  })
})

describe('pickReferences', () => {
  it('keeps everything when it fits', () => {
    expect(pickReferences(['s1'], ['a1', 'a2'], 16)).toEqual(['s1', 'a1', 'a2'])
  })

  it('gives anchors at least half of the slots when both overflow', () => {
    expect(pickReferences(['s1', 's2', 's3'], ['a1', 'a2', 'a3'], 4)).toEqual(['s1', 's2', 'a1', 'a2'])
    expect(pickReferences(['s1'], ['a1', 'a2'], 1)).toEqual(['a1'])
  })

  it('fills spare slots and drops duplicates', () => {
    expect(pickReferences(['s1', 's2', 's3'], ['a1'], 3)).toEqual(['s1', 's2', 'a1'])
    expect(pickReferences(['s1', 's1'], ['s1', 'a1'], 0)).toEqual([])
    expect(pickReferences(['s1', 's1'], ['s1', 'a1'], 5)).toEqual(['s1', 'a1'])
  })
})

describe('withRetry', () => {
  const sleep = () => Promise.resolve()

  it('retries a transient failure once and returns the success', async () => {
    const attempt = vi
      .fn()
      .mockResolvedValueOnce({ variants: [], error: 'OpenRouter error 429: slow down' })
      .mockResolvedValueOnce({ variants: [{ id: 'v', imageId: 'i', createdAt: 1, cost: null }] })
    const result = await withRetry(attempt, { maxAttempts: 2, delayMs: 1, sleep })
    expect(attempt).toHaveBeenCalledTimes(2)
    expect(result.variants).toHaveLength(1)
  })

  it('does not retry permanent errors, partial successes or past the limit', async () => {
    const permanent = vi.fn().mockResolvedValue({ variants: [], error: 'OpenRouter error 400: prompt longer than 500 characters' })
    await withRetry(permanent, { maxAttempts: 3, delayMs: 1, sleep })
    expect(permanent).toHaveBeenCalledTimes(1)

    const thrown = vi.fn().mockRejectedValue(new Error('Failed to fetch'))
    expect((await withRetry(thrown, { maxAttempts: 2, delayMs: 1, sleep })).error).toBe('Failed to fetch')
    expect(thrown).toHaveBeenCalledTimes(2)
  })
})
