import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Generation } from '../lib/openrouter'
import type { ImageModel } from '../types'
import type { Card, Project } from '../workspace/types'

const generateImages = vi.fn<(...args: unknown[]) => Generation>()
vi.mock('../lib/openrouter', () => ({ generateImages: (...args: unknown[]) => generateImages(...args) }))
vi.mock('../workspace/images', () => ({
  imageDataUrl: (id: string) => Promise.resolve(id === 'missing' ? undefined : `data:image/png;base64,${id}`),
  storeImageUrl: (url: string) => Promise.resolve(`stored-${url}`),
}))

const { generateCardVariants } = await import('../workspace/generateCard')

const model: ImageModel = {
  id: 'm',
  label: 'M',
  description: '',
  createdAt: null,
  aspectRatios: ['2:3'],
  resolutions: null,
  maxImagesPerRequest: 4,
  maxReferenceImages: 2,
  outputFormats: null,
  imageOutputPrice: null,
}
const card: Card = { id: 'c', title: 'The Fool', number: '0', prompt: 'traveller', status: 'idle', variants: [] }
const project: Project = {
  id: 'p',
  name: 'Tarot',
  createdAt: 0,
  updatedAt: 0,
  styleGuide: 'gold engraving',
  referenceIds: ['r1', 'missing', 'r3'],
  settings: { modelId: 'm', ratio: '2:3', variantsPerCard: 3 },
  cards: [card],
}

beforeEach(() => generateImages.mockReset())

describe('generateCardVariants', () => {
  it('splits the billed cost over the images that arrived and reports the failure', async () => {
    generateImages.mockReturnValue({
      images: [Promise.resolve('a'), Promise.reject(new Error('slot failed')), Promise.resolve('b')],
      cost: Promise.resolve(0.09),
    })
    const result = await generateCardVariants('key', project, card, model)
    expect(result.variants.map((v) => v.imageId)).toEqual(['stored-a', 'stored-b'])
    expect(result.variants.every((v) => v.cost === 0.045)).toBe(true)
    expect(result.error).toBe('slot failed')
  })

  it('sends the style, ratio, variant count and at most the accepted references', async () => {
    generateImages.mockReturnValue({ images: [], cost: Promise.resolve(null) })
    await generateCardVariants('key', project, card, model)
    const params = generateImages.mock.calls[0][1] as { prompt: string; count: number; ratio: string; attachments: { id: string }[] }
    expect(params.prompt).toContain('gold engraving')
    expect(params).toMatchObject({ count: 3, ratio: '2:3' })
    expect(params.attachments.map((a) => a.id)).toEqual(['r1'])
  })
})
