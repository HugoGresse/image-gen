import { createZipParts } from '../lib/zip'
import { fileExtension } from '../lib/outputFormat'
import { escapeXml, framedSvgMarkup, projectFrame, ratioSize } from './frame'
import { imageDataUrl } from './images'
import { projectLabel } from './reducer'
import type { Card, Project } from './types'

const EXPORT_SCALE = 2

export interface ExportItem {
  card: Card
  imageId: string
}

export function exportableItems(project: Project): ExportItem[] {
  return project.cards.flatMap((card) => {
    const chosen = card.variants.find((variant) => variant.id === card.chosenVariantId)
    return chosen ? [{ card, imageId: chosen.imageId }] : []
  })
}

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function exportFileName(index: number, card: Pick<Card, 'title' | 'number'>, extension: string): string {
  const parts = [String(index + 1).padStart(3, '0'), slugify(card.number), slugify(card.title)].filter(Boolean)
  return `${parts.join('-')}.${extension}`
}

async function svgToPng(markup: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Export needs a canvas, which this browser refused.')
    context.drawImage(image, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the exported image.'))), 'image/png')
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Could not read an image for export.'))
    reader.readAsDataURL(blob)
  })
}

async function readSource(source: string, title: string): Promise<Blob> {
  try {
    const response = await fetch(source)
    if (!response.ok) throw new Error(String(response.status))
    return await response.blob()
  } catch (error) {
    throw new Error(`Could not read the image of "${title}" (the provider blocked the download). Regenerate it to export it.`, {
      cause: error,
    })
  }
}

/** The item as delivered: framed and flattened to PNG when the project draws a frame, else the raw image. */
export async function renderItem(project: Project, item: ExportItem, scale = EXPORT_SCALE): Promise<{ blob: Blob; extension: string }> {
  const source = await imageDataUrl(item.imageId)
  if (!source) throw new Error(`The image of "${item.card.title}" is missing from local storage.`)
  const frame = projectFrame(project)
  if (!frame.enabled) return { blob: await readSource(source, item.card.title), extension: fileExtension(source) }
  // An SVG drawn as an image may only embed data URLs, so hosted images are inlined first.
  const inline = source.startsWith('data:') ? source : await blobToDataUrl(await readSource(source, item.card.title))
  const { width, height } = ratioSize(project.settings.ratio)
  const markup = framedSvgMarkup(project.settings.ratio, frame, item.card, { imageUrl: inline, sizing: 'intrinsic' })
  return { blob: await svgToPng(markup, width * scale, height * scale), extension: 'png' }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function exportZip(project: Project, onProgress?: (done: number, total: number) => void): Promise<number> {
  const items = exportableItems(project)
  const entries = []
  for (const [index, item] of items.entries()) {
    const { blob, extension } = await renderItem(project, item)
    entries.push({ name: exportFileName(index, item.card, extension), data: new Uint8Array(await blob.arrayBuffer()) })
    onProgress?.(index + 1, items.length)
  }
  download(new Blob(createZipParts(entries), { type: 'application/zip' }), `${slugify(projectLabel(project)) || 'project'}.zip`)
  return entries.length
}

/** A4 sheet with items at their physical width, for printing or saving as PDF. */
export function printSheetHtml(title: string, images: string[], ratio: string, itemWidthMm: number): string {
  const { width, height } = ratioSize(ratio)
  const itemHeightMm = Math.round((itemWidthMm * height) / width)
  const items = images
    .map((src) => `<img src="${escapeXml(src)}" style="width:${itemWidthMm}mm;height:${itemHeightMm}mm" alt="">`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(title)}</title><style>
@page { size: A4; margin: 8mm; }
body { margin: 0; display: flex; flex-wrap: wrap; gap: 3mm; justify-content: center; }
img { object-fit: cover; break-inside: avoid; }
</style></head><body>${items}<script>window.addEventListener('load', () => window.print())</script></body></html>`
}

/** Opens the print dialog on a sheet of every chosen item; the user can print or save it as PDF. */
export async function printProject(project: Project, itemWidthMm: number): Promise<void> {
  const target = window.open('', '_blank')
  if (!target) throw new Error('The browser blocked the print window; allow pop-ups for this site.')
  const urls: string[] = []
  try {
    for (const item of exportableItems(project)) {
      urls.push(URL.createObjectURL((await renderItem(project, item, 1)).blob))
    }
  } catch (error) {
    urls.forEach((url) => URL.revokeObjectURL(url))
    target.close()
    throw error
  }
  target.addEventListener('pagehide', () => urls.forEach((url) => URL.revokeObjectURL(url)), { once: true })
  target.document.write(printSheetHtml(projectLabel(project), urls, project.settings.ratio, itemWidthMm))
  target.document.close()
}
