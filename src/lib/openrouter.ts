import OpenAI from 'openai'
import type { AspectRatio } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_IMAGES_PER_REQUEST = 8

export const ASPECT_RATIO_DIMENSIONS: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1344, height: 768 },
  '9:16': { width: 768, height: 1344 },
  '4:3': { width: 1024, height: 768 },
  '3:4': { width: 768, height: 1024 },
  '3:2': { width: 1216, height: 832 },
  '2:3': { width: 832, height: 1216 },
}

export const IMAGE_MODELS = [
  { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro' },
  { id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell (fast)' },
  { id: 'black-forest-labs/flux-1-pro', label: 'FLUX 1 Pro' },
  { id: 'openai/dall-e-3', label: 'DALL·E 3' },
  { id: 'ideogram-ai/ideogram-v2', label: 'Ideogram V2' },
  { id: 'recraft-ai/recraft-v3', label: 'Recraft V3' },
]

export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Image Gen Dashboard',
    },
  })
}

export async function generateImages(
  apiKey: string,
  prompt: string,
  count: number,
  ratio: AspectRatio,
  model: string
): Promise<string[]> {
  const client = createOpenRouterClient(apiKey)
  const dims = ASPECT_RATIO_DIMENSIONS[ratio]
  const safeCount = Math.min(Math.max(count, 1), MAX_IMAGES_PER_REQUEST)
  const response = await client.images.generate({
    model,
    prompt,
    n: safeCount,
    // OpenRouter supports arbitrary sizes; cast to satisfy strict OpenAI types
    size: `${dims.width}x${dims.height}` as '1024x1024',
    response_format: 'url',
  })

  const data = (response as OpenAI.ImagesResponse).data ?? []
  const urls = data
    .map((item) => item?.url)
    .filter((url): url is string => Boolean(url))

  if (urls.length !== safeCount) {
    throw new Error('Image generation returned incomplete results. Please try again.')
  }

  return urls
}

/**
 * Generates a new batch of images using an enriched prompt derived from the
 * original prompt and the number of selected images.  Image-to-image transfer
 * is not supported by the OpenRouter text-to-image API, so this is a
 * text-only re-generation with a creatively enhanced prompt.
 */
export async function generateRevampedImages(
  apiKey: string,
  originalPrompt: string,
  count: number,
  ratio: AspectRatio,
  model: string
): Promise<string[]> {
  const revampPrompt = `Create an improved and more visually striking version of: ${originalPrompt}. Make it more creative, detailed, atmospheric, and compositionally interesting.`
  return generateImages(apiKey, revampPrompt, count, ratio, model)
}
