import OpenAI from 'openai'
import type { AspectRatio } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

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

  const promises = Array.from({ length: count }, () =>
    client.images.generate({
      model,
      prompt,
      n: 1,
      // OpenRouter supports arbitrary sizes; cast to satisfy strict OpenAI types
      size: `${dims.width}x${dims.height}` as '1024x1024',
      response_format: 'url',
    })
  )

  const results = await Promise.all(promises)
  return results.map((r) => {
    const data = (r as OpenAI.ImagesResponse).data
    const item = data?.[0]
    return item?.url ?? ''
  })
}

export async function generateRevampedImages(
  apiKey: string,
  originalPrompt: string,
  selectedImages: string[],
  count: number,
  ratio: AspectRatio,
  model: string
): Promise<string[]> {
  const revampPrompt = `Based on the style and composition of the selected images, create an improved and revamped version of: ${originalPrompt}. Make it more creative, detailed, and visually striking.`
  return generateImages(apiKey, revampPrompt, count * selectedImages.length, ratio, model)
}

