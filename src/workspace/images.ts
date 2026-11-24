import { getImage, putImage } from './db'

const objectUrls = new Map<string, string>()

async function toBlob(url: string): Promise<Blob | undefined> {
  try {
    const response = await fetch(url)
    return response.ok ? await response.blob() : undefined
  } catch {
    return undefined
  }
}

/** Saves a generated image (data URL or hosted URL) and returns its id. */
export async function storeImageUrl(url: string): Promise<string> {
  const id = crypto.randomUUID()
  const blob = await toBlob(url)
  await putImage(blob ? { id, blob } : { id, url })
  return id
}

export async function storeImageFile(file: Blob): Promise<string> {
  const id = crypto.randomUUID()
  await putImage({ id, blob: file })
  return id
}

/** Displayable URL for a stored image; object URLs are cached for the page lifetime. */
export async function imageUrl(id: string): Promise<string | undefined> {
  const cached = objectUrls.get(id)
  if (cached) return cached
  const image = await getImage(id)
  if (!image) return undefined
  if (!image.blob) return image.url
  const url = URL.createObjectURL(image.blob)
  objectUrls.set(id, url)
  return url
}

export function forgetImageUrls(ids: string[]): void {
  ids.forEach((id) => {
    const url = objectUrls.get(id)
    if (url) URL.revokeObjectURL(url)
    objectUrls.delete(id)
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read a stored image.'))
    reader.readAsDataURL(blob)
  })
}

/** Reference images travel inline, since object URLs mean nothing to the API. */
export async function imageDataUrl(id: string): Promise<string | undefined> {
  const image = await getImage(id)
  if (!image) return undefined
  return image.blob ? blobToDataUrl(image.blob) : image.url
}
