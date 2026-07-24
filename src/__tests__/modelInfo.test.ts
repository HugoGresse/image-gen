import { describe, it, expect } from 'vitest'
import {
  acceptsReferenceImages,
  formatBatchSize,
  formatImageOutputPrice,
  formatReferenceSupport,
  formatReleaseDate,
  isRecentRelease,
  modelMetaParts,
  summarizeDescription,
} from '../lib/modelInfo'
import type { ImageModel } from '../types'

const JUNE_2026 = Date.UTC(2026, 5, 15) / 1_000

function model(overrides: Partial<ImageModel> = {}): ImageModel {
  return {
    id: 'bytedance-seed/seedream-4.5',
    label: 'Seedream 4.5',
    description: '',
    createdAt: JUNE_2026,
    aspectRatios: ['1:1', '16:9'],
    resolutions: ['1K', '2K', '4K'],
    maxImagesPerRequest: 10,
    maxReferenceImages: 14,
    imageOutputPrice: 0.00003,
    ...overrides,
  }
}

describe('formatImageOutputPrice', () => {
  it('prices image output per 1K tokens', () => {
    expect(formatImageOutputPrice(0.00012)).toBe('$0.12/1K img')
    expect(formatImageOutputPrice(0.00003)).toBe('$0.03/1K img')
    expect(formatImageOutputPrice(0.002)).toBe('$2/1K img')
  })

  it('returns null when the price is unknown or zero', () => {
    expect(formatImageOutputPrice(null)).toBeNull()
    expect(formatImageOutputPrice(0)).toBeNull()
  })
})

describe('formatBatchSize', () => {
  it('describes how many images one request returns', () => {
    expect(formatBatchSize(10)).toBe('10/request')
    expect(formatBatchSize(1)).toBe('1/request')
  })
})

describe('formatReferenceSupport', () => {
  it('describes reference image support', () => {
    expect(formatReferenceSupport(0)).toBe('No reference images')
    expect(formatReferenceSupport(1)).toBe('1 reference image')
    expect(formatReferenceSupport(14)).toBe('Up to 14 references')
  })
})

describe('acceptsReferenceImages', () => {
  it('is true only when the model takes at least one reference', () => {
    expect(acceptsReferenceImages(model())).toBe(true)
    expect(acceptsReferenceImages(model({ maxReferenceImages: 0 }))).toBe(false)
  })
})

describe('formatReleaseDate', () => {
  it('formats the unix timestamp as month and year', () => {
    expect(formatReleaseDate(Date.UTC(2026, 5, 15) / 1_000)).toBe('Jun 2026')
  })

  it('returns null when missing', () => {
    expect(formatReleaseDate(null)).toBeNull()
  })
})

describe('isRecentRelease', () => {
  const now = Date.UTC(2026, 6, 24)

  it('flags releases within the last 60 days', () => {
    expect(isRecentRelease(Date.UTC(2026, 6, 1) / 1_000, now)).toBe(true)
  })

  it('does not flag older releases', () => {
    expect(isRecentRelease(Date.UTC(2026, 0, 1) / 1_000, now)).toBe(false)
  })

  it('does not flag unknown or future dates', () => {
    expect(isRecentRelease(null, now)).toBe(false)
    expect(isRecentRelease(Date.UTC(2027, 0, 1) / 1_000, now)).toBe(false)
  })
})

describe('summarizeDescription', () => {
  it('unwraps markdown links and keeps the first sentence', () => {
    const raw = '[GPT-5.4](https://openrouter.ai/openai/gpt-5.4) Image 2 combines **things**. It also does more.'
    expect(summarizeDescription(raw)).toBe('GPT-5.4 Image 2 combines things.')
  })

  it('collapses whitespace and falls back to the whole text without punctuation', () => {
    expect(summarizeDescription('  a fast\n\nimage model  ')).toBe('a fast image model')
  })

  it('handles an empty description', () => {
    expect(summarizeDescription('')).toBe('')
  })
})

describe('modelMetaParts', () => {
  it('lists price, batch size, resolutions, and release date', () => {
    expect(modelMetaParts(model())).toEqual(['$0.03/1K img', '10/request', '1K/2K/4K', 'Jun 2026'])
  })

  it('omits unknown facts instead of showing placeholders', () => {
    const sparse = model({ imageOutputPrice: null, resolutions: null, createdAt: null })
    expect(modelMetaParts(sparse)).toEqual(['10/request'])
  })
})
