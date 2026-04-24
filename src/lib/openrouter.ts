import type { AspectRatio } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_IMAGES_PER_REQUEST = 8

export const IMAGE_MODELS = [
  { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro' },
  { id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell (fast)' },
  { id: 'black-forest-labs/flux-1-pro', label: 'FLUX 1 Pro' },
  { id: 'openai/dall-e-3', label: 'DALL·E 3' },
  { id: 'ideogram-ai/ideogram-v2', label: 'Ideogram V2' },
  { id: 'recraft-ai/recraft-v3', label: 'Recraft V3' },
]

async function generateSingleImage(
  apiKey: string,
  prompt: string,
  ratio: AspectRatio,
  model: string,
): Promise<string> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Image Gen Dashboard',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image'],
      image_config: { aspect_ratio: ratio },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenRouter error ${response.status}: ${text.slice(0, 400)}`)
  }

  const data = await response.json()
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!url) {
    throw new Error('No image returned from OpenRouter. Please try again.')
  }
  return url
}

export async function generateImages(
  apiKey: string,
  prompt: string,
  count: number,
  ratio: AspectRatio,
  model: string
): Promise<string[]> {
  const safeCount = Math.min(Math.max(count, 1), MAX_IMAGES_PER_REQUEST)
  return Promise.all(
    Array.from({ length: safeCount }, () => generateSingleImage(apiKey, prompt, ratio, model)),
  )
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
