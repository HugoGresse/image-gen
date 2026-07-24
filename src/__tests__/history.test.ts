import { describe, it, expect } from 'vitest'
import { MAX_STORED_SESSIONS, pruneSessions, sanitizeSession } from '../lib/history'
import type { GeneratedImage, ImageModel, ImageSession } from '../types'

const MODEL: ImageModel = {
  id: 'bytedance-seed/seedream-4.5',
  label: 'Seedream 4.5',
  description: '',
  createdAt: null,
  aspectRatios: null,
  resolutions: null,
  maxImagesPerRequest: 1,
  maxReferenceImages: 0,
  imageOutputPrice: null,
}

function image(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'img',
    url: 'data:image/png;base64,AAAA',
    prompt: 'a neon city',
    ratio: '1:1',
    model: MODEL.id,
    createdAt: 10,
    selected: false,
    ...overrides,
  }
}

function session(overrides: Partial<ImageSession> = {}): ImageSession {
  return {
    id: 's1',
    createdAt: 10,
    params: { prompt: 'a neon city', count: 1, ratio: '1:1', model: MODEL },
    images: [image()],
    ...overrides,
  }
}

describe('sanitizeSession', () => {
  it('drops images that are still loading or failed', () => {
    const result = sanitizeSession(
      session({
        images: [
          image({ id: 'done' }),
          image({ id: 'pending', loading: true, url: '' }),
          image({ id: 'failed', url: '' }),
        ],
      })
    )
    expect(result?.images.map((i) => i.id)).toEqual(['done'])
  })

  it('clears the loading flag and selection so restored images render idle', () => {
    const result = sanitizeSession(session({ images: [image({ selected: true, loading: false })] }))
    expect(result?.images[0].selected).toBe(false)
    expect(result?.images[0]).not.toHaveProperty('loading')
  })

  it('returns null when nothing is worth storing', () => {
    expect(sanitizeSession(session({ images: [image({ loading: true, url: '' })] }))).toBeNull()
    expect(sanitizeSession(session({ images: [] }))).toBeNull()
  })

  it('keeps the prompt and generation params', () => {
    const result = sanitizeSession(session())
    expect(result?.params.prompt).toBe('a neon city')
    expect(result?.params.model.id).toBe(MODEL.id)
  })
})

describe('pruneSessions', () => {
  it('sorts newest first', () => {
    const pruned = pruneSessions([
      session({ id: 'old', createdAt: 1 }),
      session({ id: 'new', createdAt: 5 }),
      session({ id: 'middle', createdAt: 3 }),
    ])
    expect(pruned.map((s) => s.id)).toEqual(['new', 'middle', 'old'])
  })

  it('caps the number of stored sessions', () => {
    const many = Array.from({ length: MAX_STORED_SESSIONS + 5 }, (_, i) =>
      session({ id: `s${i}`, createdAt: i })
    )
    const pruned = pruneSessions(many)
    expect(pruned).toHaveLength(MAX_STORED_SESSIONS)
    expect(pruned[0].id).toBe(`s${MAX_STORED_SESSIONS + 4}`)
  })

  it('drops sessions with no finished images', () => {
    const pruned = pruneSessions([
      session({ id: 'kept' }),
      session({ id: 'in-flight', images: [image({ loading: true, url: '' })] }),
    ])
    expect(pruned.map((s) => s.id)).toEqual(['kept'])
  })

  it('honours a custom cap', () => {
    const pruned = pruneSessions([session({ id: 'a', createdAt: 1 }), session({ id: 'b', createdAt: 2 })], 1)
    expect(pruned.map((s) => s.id)).toEqual(['b'])
  })
})
