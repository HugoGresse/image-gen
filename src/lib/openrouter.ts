import type { AspectRatio } from '../types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_IMAGES_PER_REQUEST = 8

export interface ImageModel {
  id: string
  label: string
}

interface OpenRouterModelEntry {
  id: string
  name: string
  architecture?: {
    modality?: string
  }
}

export async function fetchImageModels(): Promise<ImageModel[]> {
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`)
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status}`)
  }
  const data = await response.json()
  return (data.data as OpenRouterModelEntry[])
    .filter((m) => {
      const parts = m.architecture?.modality?.split('->')
      return parts && parts.length === 2 && parts[1].includes('image')
    })
    .map((m) => ({ id: m.id, label: m.name }))
}

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
    const snippet = text.slice(0, 400)
    const suffix = text.length > 400 ? '… (truncated)' : ''
    throw new Error(`OpenRouter error ${response.status}: ${snippet}${suffix}`)
  }

  const data = await response.json()
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!url) {
    throw new Error('No image returned from OpenRouter. Please try again.')
  }
  return url
}

/**
 * Returns an array of individual promises — one per image — so the caller can
 * display each image as soon as it resolves rather than waiting for the full batch.
 */
export function generateImages(
  apiKey: string,
  prompt: string,
  count: number,
  ratio: AspectRatio,
  model: string
): Promise<string>[] {
  const safeCount = Math.min(Math.max(count, 1), MAX_IMAGES_PER_REQUEST)
  return Array.from({ length: safeCount }, () => generateSingleImage(apiKey, prompt, ratio, model))
}

/**
 * Sends each selected image back to the model as a multimodal message
 * (image + refinement instruction) and requests a new image in return.
 * Returns one promise per selected image URL.
 */
async function generateSingleRevampedImage(
  apiKey: string,
  imageUrl: string,
  refinementHint: string,
  ratio: AspectRatio,
  model: string,
): Promise<string> {
  const instruction = refinementHint.trim()
    ? refinementHint.trim()
    : 'Refine and improve this image, enhancing detail, composition, and visual quality.'

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
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: instruction },
          ],
        },
      ],
      modalities: ['image'],
      image_config: { aspect_ratio: ratio },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    const snippet = text.slice(0, 400)
    const suffix = text.length > 400 ? '… (truncated)' : ''
    throw new Error(`OpenRouter error ${response.status}: ${snippet}${suffix}`)
  }

  const data = await response.json()
  const url: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url
  if (!url) {
    throw new Error('No image returned from OpenRouter. Please try again.')
  }
  return url
}

/**
 * For each selected image URL, sends it together with the user's refinement
 * hint to the model as a multimodal request and returns one promise per image.
 */
export function generateRevampedImages(
  apiKey: string,
  imageUrls: string[],
  refinementHint: string,
  ratio: AspectRatio,
  model: string
): Promise<string>[] {
  return imageUrls.map((url) => generateSingleRevampedImage(apiKey, url, refinementHint, ratio, model))
}
