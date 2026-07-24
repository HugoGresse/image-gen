import { describe, it, expect } from 'vitest'
import {
  formatContextLength,
  formatImageOutputPrice,
  formatPromptPrice,
  formatReleaseDate,
  isRecentRelease,
  modelMetaParts,
  summarizeDescription,
} from '../lib/modelInfo'
import type { ImageModel } from '../lib/openrouter'

const JUNE_2026 = Date.UTC(2026, 5, 15) / 1_000

function model(overrides: Partial<ImageModel> = {}): ImageModel {
  return {
    id: 'google/gemini-3-pro-image',
    label: 'Gemini 3 Pro Image',
    description: '',
    supportsImageInput: true,
    supportsFileInput: false,
    imageOutputPrice: 0.00012,
    promptPrice: 0.000002,
    contextLength: 131072,
    createdAt: JUNE_2026,
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

describe('formatPromptPrice', () => {
  it('prices prompt tokens per million', () => {
    expect(formatPromptPrice(0.000002)).toBe('$2/M in')
    expect(formatPromptPrice(0.00000025)).toBe('$0.25/M in')
    expect(formatPromptPrice(0.00001)).toBe('$10/M in')
  })

  it('returns null when the price is unknown', () => {
    expect(formatPromptPrice(null)).toBeNull()
  })
})

describe('formatContextLength', () => {
  it('formats thousands and millions', () => {
    expect(formatContextLength(131072)).toBe('131K ctx')
    expect(formatContextLength(32768)).toBe('33K ctx')
    expect(formatContextLength(2_000_000)).toBe('2M ctx')
  })

  it('returns null when missing', () => {
    expect(formatContextLength(null)).toBeNull()
    expect(formatContextLength(0)).toBeNull()
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
  it('lists price, context, and release facts', () => {
    expect(modelMetaParts(model())).toEqual(['$0.12/1K img', '$2/M in', '131K ctx', 'Jun 2026'])
  })

  it('omits unknown facts instead of showing placeholders', () => {
    const sparse = model({ imageOutputPrice: null, promptPrice: null, contextLength: null })
    expect(modelMetaParts(sparse)).toEqual(['Jun 2026'])
  })
})
