import { isSvgDataUrl, isSvgUrl } from './outputFormat'
import { decodeSvgDataUrl, fitSize, svgSize, withSize } from './svg'

const MIN_LONG_SIDE = 1024
const MAX_LONG_SIDE = 2048
const EMPTY_DATA_URL = 'data:,'

async function readSvgMarkup(url: string): Promise<string> {
  if (isSvgDataUrl(url)) return decodeSvgDataUrl(url)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not load SVG reference: ${response.status}`)
  return response.text()
}

async function drawSvg(markup: string): Promise<string> {
  const size = fitSize(svgSize(markup), MIN_LONG_SIDE, MAX_LONG_SIDE)
  const objectUrl = URL.createObjectURL(new Blob([withSize(markup, size)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = objectUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not convert SVG reference: canvas is unavailable.')
    context.drawImage(image, 0, 0, size.width, size.height)

    const png = canvas.toDataURL('image/png')
    if (png === EMPTY_DATA_URL) throw new Error('Could not convert SVG reference: image too large.')
    return png
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Reference images must be raster, so SVGs (inline or hosted) are drawn onto a canvas and sent as PNG. */
export async function toReferenceUrl(url: string): Promise<string> {
  return isSvgUrl(url) ? drawSvg(await readSvgMarkup(url)) : url
}
