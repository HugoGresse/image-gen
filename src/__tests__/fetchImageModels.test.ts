import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractCost, extractImages, fetchImageModels, sumCosts, unsupportedAttachmentKinds } from '../lib/openrouter'
import type { Attachment, ImageModel } from '../types'

// Sample of GET /api/v1/images/models
const IMAGE_MODELS = [
  {
    id: 'bytedance-seed/seedream-4.5',
    name: 'Seedream 4.5',
    description: 'ByteDance image model.',
    created: 1_770_000_000,
    supported_parameters: {
      resolution: { type: 'enum', values: ['1K', '2K', '4K'] },
      aspect_ratio: { type: 'enum', values: ['1:1', '16:9', '9:16'] },
      n: { type: 'range', min: 1, max: 10 },
      input_references: { type: 'range', min: 0, max: 14 },
    },
  },
  {
    // No aspect_ratio and no input_references: parameters must come back null / 0
    id: 'black-forest-labs/flux.2-pro',
    name: 'FLUX.2 Pro',
    supported_parameters: {
      n: { type: 'range', min: 1, max: 1 },
      input_references: { type: 'range', min: 0, max: 8 },
    },
  },
  {
    id: 'openrouter/auto',
    name: 'Auto Router',
    supported_parameters: {},
  },
]

// Sample of GET /api/v1/models?output_modalities=image, used only for pricing
const PRICED_MODELS = [
  { id: 'bytedance-seed/seedream-4.5', pricing: { image_output: '0.00003' } },
  { id: 'openrouter/auto', pricing: { prompt: '-1', image_output: '-1' } },
]

function stubFetch(imageModels: unknown = IMAGE_MODELS, priced: unknown = PRICED_MODELS) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: url.includes('/images/models') ? imageModels : priced }),
      })
    )
  )
}

beforeEach(() => stubFetch())

describe('fetchImageModels', () => {
  it('reads every model exposed by the Images API', async () => {
    const models = await fetchImageModels()
    expect(models.map((m) => m.id)).toEqual([
      'bytedance-seed/seedream-4.5',
      'black-forest-labs/flux.2-pro',
      'openrouter/auto',
    ])
  })

  it('maps the per-model limits used to build requests', async () => {
    const [seedream] = await fetchImageModels()
    expect(seedream).toMatchObject({
      label: 'Seedream 4.5',
      aspectRatios: ['1:1', '16:9', '9:16'],
      resolutions: ['1K', '2K', '4K'],
      maxImagesPerRequest: 10,
      maxReferenceImages: 14,
      createdAt: 1_770_000_000,
    })
  })

  it('defaults missing parameters: no ratios, one image per request, no references', async () => {
    const models = await fetchImageModels()
    expect(models.find((m) => m.id === 'black-forest-labs/flux.2-pro')).toMatchObject({
      aspectRatios: null,
      maxImagesPerRequest: 1,
      maxReferenceImages: 8,
    })
    expect(models.find((m) => m.id === 'openrouter/auto')).toMatchObject({
      aspectRatios: null,
      maxImagesPerRequest: 1,
      maxReferenceImages: 0,
    })
  })

  it('merges pricing and treats variable "-1" pricing as unpriced', async () => {
    const models = await fetchImageModels()
    expect(models.find((m) => m.id === 'bytedance-seed/seedream-4.5')?.imageOutputPrice).toBe(0.00003)
    expect(models.find((m) => m.id === 'openrouter/auto')?.imageOutputPrice).toBeNull()
    expect(models.find((m) => m.id === 'black-forest-labs/flux.2-pro')?.imageOutputPrice).toBeNull()
  })

  it('still returns models when the pricing endpoint fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        url.includes('/images/models')
          ? Promise.resolve({ ok: true, json: () => Promise.resolve({ data: IMAGE_MODELS }) })
          : Promise.resolve({ ok: false, status: 500 })
      )
    )
    const models = await fetchImageModels()
    expect(models).toHaveLength(3)
    expect(models[0].imageOutputPrice).toBeNull()
  })

  it('throws when the model catalogue responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(fetchImageModels()).rejects.toThrow('Failed to fetch models: 500')
  })
})

describe('extractImages', () => {
  it('builds data URLs from base64 entries', () => {
    const urls = extractImages({ data: [{ b64_json: 'AAAA', media_type: 'image/webp' }] })
    expect(urls).toEqual(['data:image/webp;base64,AAAA'])
  })

  it('defaults the media type to png', () => {
    expect(extractImages({ data: [{ b64_json: 'AAAA' }] })).toEqual(['data:image/png;base64,AAAA'])
  })

  it('passes through hosted urls and skips empty entries', () => {
    const urls = extractImages({ data: [{ url: 'https://cdn.example/img.png' }, {}] })
    expect(urls).toEqual(['https://cdn.example/img.png'])
  })

  it('handles a malformed payload', () => {
    expect(extractImages({})).toEqual([])
  })
})

describe('unsupportedAttachmentKinds', () => {
  const model = (overrides: Partial<ImageModel>): ImageModel => ({
    id: 'm',
    label: 'Model',
    description: '',
    createdAt: null,
    aspectRatios: null,
    resolutions: null,
    maxImagesPerRequest: 1,
    maxReferenceImages: 0,
    imageOutputPrice: null,
    ...overrides,
  })
  const attachment = (kind: Attachment['kind']): Attachment => ({
    id: kind,
    name: kind,
    mimeType: '',
    size: 1,
    kind,
    data: '',
  })

  it('flags images for models that take no references', () => {
    expect(unsupportedAttachmentKinds([attachment('image')], model({}))).toEqual(['image'])
  })

  it('accepts images when the model takes references', () => {
    expect(unsupportedAttachmentKinds([attachment('image')], model({ maxReferenceImages: 4 }))).toEqual([])
  })

  it('always flags PDFs, which the Images API cannot accept', () => {
    expect(unsupportedAttachmentKinds([attachment('pdf')], model({ maxReferenceImages: 4 }))).toEqual(['pdf'])
  })

  it('never flags text documents, which are inlined into the prompt', () => {
    expect(unsupportedAttachmentKinds([attachment('text')], model({}))).toEqual([])
  })

  it('reports nothing while no model is selected yet', () => {
    expect(unsupportedAttachmentKinds([attachment('image')], undefined)).toEqual([])
  })
})

describe('extractCost and sumCosts', () => {
  it('reads the billed cost from the response usage block', () => {
    expect(extractCost({ usage: { cost: 0.0421 } })).toBe(0.0421)
  })

  it('returns null when no cost is reported', () => {
    expect(extractCost({})).toBeNull()
    expect(extractCost({ usage: {} })).toBeNull()
  })

  it('sums only the requests that reported a cost', () => {
    expect(sumCosts([0.01, null, 0.02])).toBeCloseTo(0.03)
  })

  it('returns null when nothing was reported', () => {
    expect(sumCosts([null, null])).toBeNull()
    expect(sumCosts([])).toBeNull()
  })
})
