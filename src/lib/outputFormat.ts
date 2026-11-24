import type { ImageModel } from '../types'

export const VECTOR_FORMAT = 'svg'

const MEDIA_TYPES: Record<string, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export function supportsVector(model: ImageModel): boolean {
  return model.outputFormats?.includes(VECTOR_FORMAT) ?? false
}

export function isVectorOnly(model: ImageModel): boolean {
  const formats = model.outputFormats ?? []
  return formats.length > 0 && formats.every((format) => format === VECTOR_FORMAT)
}

/** Only SVG is ever sent explicitly; raster requests keep the provider's default format. */
export function resolveOutputFormat(model: ImageModel, preferVector: boolean): string | undefined {
  if (!supportsVector(model)) return undefined
  return preferVector || isVectorOnly(model) ? VECTOR_FORMAT : undefined
}

export function mediaTypeFor(format: string | undefined): string {
  return (format && MEDIA_TYPES[format]) || MEDIA_TYPES.png
}

/**
 * Raster models that can also vectorise (GPT Image 2.6) accept only n=1 for SVG,
 * a limit the catalogue does not express; vector-only models declare their own `n`.
 */
export function imagesPerRequest(model: ImageModel, format: string | undefined): number {
  return format === VECTOR_FORMAT && !isVectorOnly(model) ? 1 : model.maxImagesPerRequest
}

export function isSvgDataUrl(url: string): boolean {
  return url.startsWith(`data:${MEDIA_TYPES.svg}`)
}

function extensionOf(url: string): string | undefined {
  const dataType = url.match(/^data:([^;,]+)/)?.[1]
  if (dataType) return EXTENSIONS[dataType]
  try {
    return new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  } catch {
    return undefined
  }
}

export function isSvgUrl(url: string): boolean {
  return extensionOf(url) === 'svg'
}

export function downloadFileName(id: string, url: string): string {
  return `image-${id}.${extensionOf(url) ?? 'png'}`
}
