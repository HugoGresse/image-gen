import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchImageModels, unsupportedAttachmentKinds } from '../lib/openrouter'
import type { ImageModel } from '../lib/openrouter'
import type { Attachment } from '../types'

// Realistic sample of models as returned by GET /api/v1/models
const MOCK_MODELS = [
  // Image generation models (text -> image)
  {
    id: 'black-forest-labs/flux-1.1-pro',
    name: 'FLUX 1.1 Pro',
    architecture: { modality: 'text->image' },
  },
  // Multimodal image models, described with the newer modality arrays
  {
    id: 'google/gemini-3-pro-image',
    name: 'Gemini 3 Pro Image',
    architecture: {
      modality: 'text+image->text+image',
      input_modalities: ['image', 'text'],
      output_modalities: ['image', 'text'],
    },
  },
  {
    id: 'openai/gpt-5-image',
    name: 'GPT-5 Image',
    architecture: {
      modality: 'text+image+file->text+image',
      input_modalities: ['image', 'text', 'file'],
      output_modalities: ['image', 'text'],
    },
  },
  {
    id: 'black-forest-labs/flux-schnell',
    name: 'FLUX Schnell',
    architecture: { modality: 'text->image' },
  },
  {
    id: 'openai/dall-e-3',
    name: 'DALL·E 3',
    architecture: { modality: 'text->image' },
  },
  {
    id: 'recraft-ai/recraft-v3',
    name: 'Recraft V3',
    architecture: { modality: 'text->image' },
  },
  // Text-only models — must be excluded
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    architecture: { modality: 'text+image->text' },
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    architecture: { modality: 'text+image->text' },
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B',
    architecture: { modality: 'text->text' },
  },
  // Model with no architecture info — must be excluded
  {
    id: 'some/unknown-model',
    name: 'Unknown Model',
  },
]

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: MOCK_MODELS }),
    }),
  )
})

describe('fetchImageModels', () => {
  it('returns only models whose output modality includes image', async () => {
    const models = await fetchImageModels()
    const ids = models.map((m) => m.id)
    expect(ids).toContain('black-forest-labs/flux-1.1-pro')
    expect(ids).toContain('black-forest-labs/flux-schnell')
    expect(ids).toContain('openai/dall-e-3')
    expect(ids).toContain('recraft-ai/recraft-v3')
  })

  it('excludes text-only and vision (text input only) models', async () => {
    const models = await fetchImageModels()
    const ids = models.map((m) => m.id)
    expect(ids).not.toContain('openai/gpt-4o')
    expect(ids).not.toContain('anthropic/claude-3.5-sonnet')
    expect(ids).not.toContain('meta-llama/llama-3.1-70b-instruct')
  })

  it('excludes models with no architecture metadata', async () => {
    const models = await fetchImageModels()
    const ids = models.map((m) => m.id)
    expect(ids).not.toContain('some/unknown-model')
  })

  it('maps API name field to the label property', async () => {
    const models = await fetchImageModels()
    const fluxPro = models.find((m) => m.id === 'black-forest-labs/flux-1.1-pro')
    expect(fluxPro?.label).toBe('FLUX 1.1 Pro')
  })

  it('flags image and PDF input support from the modality arrays', async () => {
    const models = await fetchImageModels()
    const gemini = models.find((m) => m.id === 'google/gemini-3-pro-image')
    const gpt = models.find((m) => m.id === 'openai/gpt-5-image')
    expect(gemini).toMatchObject({ supportsImageInput: true, supportsFileInput: false })
    expect(gpt).toMatchObject({ supportsImageInput: true, supportsFileInput: true })
  })

  it('falls back to the modality string when arrays are absent', async () => {
    const models = await fetchImageModels()
    const fluxPro = models.find((m) => m.id === 'black-forest-labs/flux-1.1-pro')
    expect(fluxPro).toMatchObject({ supportsImageInput: false, supportsFileInput: false })
  })

  it('throws when the API responds with an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )
    await expect(fetchImageModels()).rejects.toThrow('Failed to fetch models: 500')
  })
})

describe('unsupportedAttachmentKinds', () => {
  const model = (overrides: Partial<ImageModel>): ImageModel => ({
    id: 'm',
    label: 'Model',
    supportsImageInput: false,
    supportsFileInput: false,
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

  it('reports image and PDF attachments the model cannot take', () => {
    const kinds = unsupportedAttachmentKinds([attachment('image'), attachment('pdf')], model({}))
    expect(kinds).toEqual(['image', 'pdf'])
  })

  it('reports nothing when the model supports both', () => {
    const capable = model({ supportsImageInput: true, supportsFileInput: true })
    expect(unsupportedAttachmentKinds([attachment('image'), attachment('pdf')], capable)).toEqual([])
  })

  it('never flags text documents, which are inlined into the prompt', () => {
    expect(unsupportedAttachmentKinds([attachment('text')], model({}))).toEqual([])
  })

  it('reports nothing while no model is selected yet', () => {
    expect(unsupportedAttachmentKinds([attachment('image')], undefined)).toEqual([])
  })
})
