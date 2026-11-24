import { describe, it, expect } from 'vitest'
import {
  downloadFileName,
  imagesPerRequest,
  isSvgDataUrl,
  isSvgUrl,
  isVectorOnly,
  mediaTypeFor,
  resolveOutputFormat,
  supportsVector,
} from '../lib/outputFormat'
import type { ImageModel } from '../types'

function model(overrides: Partial<ImageModel> = {}): ImageModel {
  return {
    id: 'openai/gpt-image-2.6-flare',
    label: 'GPT Image 2.6 Flare',
    description: '',
    createdAt: null,
    aspectRatios: null,
    resolutions: null,
    maxImagesPerRequest: 10,
    maxReferenceImages: 16,
    outputFormats: ['png', 'jpeg', 'webp', 'svg'],
    imageOutputPrice: null,
    ...overrides,
  }
}

const rasterOnly = model({ outputFormats: ['png', 'jpeg'] })
const vectorOnly = model({ id: 'recraft/recraft-v4-vector', outputFormats: ['svg'], maxImagesPerRequest: 6 })

describe('supportsVector and isVectorOnly', () => {
  it('detects models that can return SVG', () => {
    expect(supportsVector(model())).toBe(true)
    expect(supportsVector(rasterOnly)).toBe(false)
    expect(supportsVector(model({ outputFormats: null }))).toBe(false)
  })

  it('tells vector-only models apart from raster models that can vectorise', () => {
    expect(isVectorOnly(vectorOnly)).toBe(true)
    expect(isVectorOnly(model())).toBe(false)
    expect(isVectorOnly(model({ outputFormats: [] }))).toBe(false)
  })

  it('tolerates models stored before output formats were tracked', () => {
    const legacy = { ...model(), outputFormats: undefined } as unknown as ImageModel
    expect(supportsVector(legacy)).toBe(false)
    expect(isVectorOnly(legacy)).toBe(false)
  })
})

describe('resolveOutputFormat', () => {
  it('sends svg only when asked for and supported', () => {
    expect(resolveOutputFormat(model(), true)).toBe('svg')
    expect(resolveOutputFormat(model(), false)).toBeUndefined()
    expect(resolveOutputFormat(rasterOnly, true)).toBeUndefined()
  })

  it('always sends svg to vector-only models', () => {
    expect(resolveOutputFormat(vectorOnly, false)).toBe('svg')
  })
})

describe('imagesPerRequest', () => {
  it('limits raster models to one SVG per request', () => {
    expect(imagesPerRequest(model(), 'svg')).toBe(1)
    expect(imagesPerRequest(model(), undefined)).toBe(10)
  })

  it('keeps the declared batch size for vector-only models', () => {
    expect(imagesPerRequest(vectorOnly, 'svg')).toBe(6)
  })
})

describe('mediaTypeFor', () => {
  it('maps formats to media types and defaults to png', () => {
    expect(mediaTypeFor('svg')).toBe('image/svg+xml')
    expect(mediaTypeFor('jpeg')).toBe('image/jpeg')
    expect(mediaTypeFor(undefined)).toBe('image/png')
    expect(mediaTypeFor('tiff')).toBe('image/png')
  })
})

describe('isSvgDataUrl', () => {
  it('matches only SVG data URLs', () => {
    expect(isSvgDataUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true)
    expect(isSvgDataUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isSvgDataUrl('https://cdn.example/logo.svg')).toBe(false)
  })
})

describe('downloadFileName', () => {
  it('uses the data URL media type for the extension', () => {
    expect(downloadFileName('a1', 'data:image/svg+xml;base64,PHN2Zz4=')).toBe('image-a1.svg')
    expect(downloadFileName('a1', 'data:image/jpeg;base64,AAAA')).toBe('image-a1.jpg')
  })

  it('uses the hosted file extension', () => {
    expect(downloadFileName('a1', 'https://cdn.example/out/Logo.SVG?sig=1')).toBe('image-a1.svg')
  })

  it('falls back to png when the type is unknown', () => {
    expect(downloadFileName('a1', 'https://cdn.example/render')).toBe('image-a1.png')
    expect(downloadFileName('a1', 'not a url')).toBe('image-a1.png')
    expect(downloadFileName('a1', 'data:image/tiff;base64,AAAA')).toBe('image-a1.png')
  })
})

describe('isSvgUrl', () => {
  it('matches inline and hosted SVGs', () => {
    expect(isSvgUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true)
    expect(isSvgUrl('https://cdn.example/out/logo.svg?sig=1')).toBe(true)
    expect(isSvgUrl('https://cdn.example/out/logo.png')).toBe(false)
  })
})
