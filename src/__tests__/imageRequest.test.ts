import { describe, it, expect } from 'vitest'
import { buildInputReferences, buildPrompt, planBatches, resolveAspectRatio } from '../lib/imageRequest'
import type { Attachment, ImageModel } from '../types'

function attachment(overrides: Partial<Attachment>): Attachment {
  return { id: 'a1', name: 'file', mimeType: '', size: 10, kind: 'text', data: '', ...overrides }
}

function model(overrides: Partial<ImageModel> = {}): ImageModel {
  return {
    id: 'bytedance-seed/seedream-4.5',
    label: 'Seedream 4.5',
    description: '',
    createdAt: null,
    aspectRatios: ['1:1', '16:9', '4:3'],
    resolutions: null,
    maxImagesPerRequest: 10,
    maxReferenceImages: 14,
    imageOutputPrice: null,
    ...overrides,
  }
}

describe('buildPrompt', () => {
  it('returns the prompt unchanged when nothing is attached', () => {
    expect(buildPrompt('a neon city')).toBe('a neon city')
    expect(buildPrompt('a neon city', [])).toBe('a neon city')
  })

  it('inlines text documents as labelled reference blocks', () => {
    const prompt = buildPrompt('use the palette', [
      attachment({ kind: 'text', name: 'palette.md', data: '  violet, zinc  ' }),
    ])
    expect(prompt).toBe('use the palette\n\n--- Reference document: palette.md ---\nviolet, zinc')
  })

  it('ignores empty text documents, images, and PDFs', () => {
    const prompt = buildPrompt('a neon city', [
      attachment({ kind: 'text', name: 'empty.txt', data: '   ' }),
      attachment({ kind: 'image', name: 'ref.png', data: 'data:image/png;base64,AAAA' }),
      attachment({ kind: 'pdf', name: 'brief.pdf', data: 'data:application/pdf;base64,BBBB' }),
    ])
    expect(prompt).toBe('a neon city')
  })
})

describe('buildInputReferences', () => {
  it('maps attached images to input reference objects', () => {
    const references = buildInputReferences(
      [attachment({ kind: 'image', name: 'ref.png', data: 'data:image/png;base64,AAAA' })],
      4
    )
    expect(references).toEqual([{ type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }])
  })

  it('caps references at what the model accepts', () => {
    const images = Array.from({ length: 5 }, (_, i) =>
      attachment({ id: `a${i}`, kind: 'image', data: `data:image/png;base64,${i}` })
    )
    expect(buildInputReferences(images, 2)).toHaveLength(2)
  })

  it('returns nothing when the model takes no references', () => {
    const images = [attachment({ kind: 'image', data: 'data:image/png;base64,AAAA' })]
    expect(buildInputReferences(images, 0)).toEqual([])
  })
})

describe('planBatches', () => {
  it('fits everything in one request when the model allows it', () => {
    expect(planBatches(8, 10)).toEqual([8])
  })

  it('splits into full batches plus a remainder', () => {
    expect(planBatches(8, 6)).toEqual([6, 2])
    expect(planBatches(4, 1)).toEqual([1, 1, 1, 1])
  })

  it('handles zero and treats an invalid batch size as one image per request', () => {
    expect(planBatches(0, 4)).toEqual([])
    expect(planBatches(2, 0)).toEqual([1, 1])
  })
})

describe('resolveAspectRatio', () => {
  it('keeps a ratio the model supports', () => {
    expect(resolveAspectRatio(model(), '16:9')).toBe('16:9')
  })

  it('falls back to the first supported ratio', () => {
    expect(resolveAspectRatio(model(), '21:9')).toBe('1:1')
  })

  it('omits the parameter for models that do not expose it', () => {
    expect(resolveAspectRatio(model({ aspectRatios: null }), '1:1')).toBeUndefined()
  })
})
