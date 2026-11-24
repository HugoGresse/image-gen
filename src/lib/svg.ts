export interface Size {
  width: number
  height: number
}

const ROOT_TAG = /<svg\b[^>]*>/i

export function decodeSvgDataUrl(url: string): string {
  const comma = url.indexOf(',')
  const header = url.slice(0, comma)
  const body = url.slice(comma + 1)
  if (!header.endsWith(';base64')) return decodeURIComponent(body)
  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function attribute(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1]
}

/** Only unitless or px lengths are absolute; percentages and em depend on a container. */
function absoluteLength(value: string | undefined): number | null {
  const match = value?.trim().match(/^(\d*\.?\d+)(px)?$/i)
  const length = match ? Number(match[1]) : NaN
  return length > 0 ? length : null
}

function viewBoxSize(tag: string): Size | null {
  const parts = attribute(tag, 'viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (!parts || parts.length !== 4) return null
  const [, , width, height] = parts
  return width > 0 && height > 0 ? { width, height } : null
}

export function svgSize(markup: string): Size | null {
  const tag = markup.match(ROOT_TAG)?.[0]
  if (!tag) return null
  const width = absoluteLength(attribute(tag, 'width'))
  const height = absoluteLength(attribute(tag, 'height'))
  if (width && height) return { width, height }
  return viewBoxSize(tag)
}

/** Scales a size so its long side lands within [min, max], keeping the aspect ratio. */
export function fitSize(size: Size | null, min: number, max: number): Size {
  if (!size) return { width: min, height: min }
  const longSide = Math.max(size.width, size.height)
  const scale = longSide < min ? min / longSide : longSide > max ? max / longSide : 1
  return { width: Math.round(size.width * scale), height: Math.round(size.height * scale) }
}

/**
 * Pins explicit width/height on the root element: browsers draw an SVG without an
 * intrinsic size at 300×150 (Chrome) or refuse to draw it on a canvas (Firefox).
 * A viewBox is added from the original size so the content scales instead of cropping.
 */
export function withSize(markup: string, size: Size): string {
  return markup.replace(ROOT_TAG, (tag) => {
    const original = svgSize(tag)
    const stripped = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '')
    const viewBox =
      attribute(tag, 'viewBox') === undefined && original ? ` viewBox="0 0 ${original.width} ${original.height}"` : ''
    return stripped.replace(/^<svg\b/i, `<svg width="${size.width}" height="${size.height}"${viewBox}`)
  })
}
