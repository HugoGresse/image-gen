import type { Card, Project } from './types'

export type FrameFont = 'serif' | 'sans' | 'mono'

export interface FrameSettings {
  enabled: boolean
  borderColor: string
  backgroundColor: string
  textColor: string
  /** Border thickness as a percentage of the item width. */
  borderWidth: number
  /** Corner radius as a percentage of the item width. */
  cornerRadius: number
  showTitle: boolean
  showNumber: boolean
  font: FrameFont
}

export const DEFAULT_FRAME: FrameSettings = {
  enabled: false,
  borderColor: '#c9a227',
  backgroundColor: '#14110d',
  textColor: '#f3e6c4',
  borderWidth: 4,
  cornerRadius: 4,
  showTitle: true,
  showNumber: true,
  font: 'serif',
}

const FONT_STACKS: Record<FrameFont, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Arial, sans-serif",
  mono: "'Courier New', monospace",
}

const BASE_WIDTH = 1000
const TITLE_BAND = 0.11
const NUMBER_BAND = 0.075
const HEX_COLOR = /^#[0-9a-f]{6}$/i

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface FrameLayout {
  width: number
  height: number
  border: number
  radius: number
  image: Rect
  title: (Rect & { fontSize: number }) | null
  number: (Rect & { fontSize: number }) | null
}

export function projectFrame(project: Pick<Project, 'frame'>): FrameSettings {
  return sanitizeFrame(project.frame)
}

export function ratioSize(ratio: string, width = BASE_WIDTH): { width: number; height: number } {
  const [w, h] = ratio.split(':').map(Number)
  return w > 0 && h > 0 ? { width, height: Math.round((width * h) / w) } : { width, height: width }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export function sanitizeFrame(frame: Partial<FrameSettings> | undefined): FrameSettings {
  const merged = { ...DEFAULT_FRAME, ...frame }
  const color = (value: string, fallback: string) => (HEX_COLOR.test(value) ? value : fallback)
  return {
    ...merged,
    borderColor: color(merged.borderColor, DEFAULT_FRAME.borderColor),
    backgroundColor: color(merged.backgroundColor, DEFAULT_FRAME.backgroundColor),
    textColor: color(merged.textColor, DEFAULT_FRAME.textColor),
    borderWidth: clamp(Number(merged.borderWidth) || 0, 0, 12),
    cornerRadius: clamp(Number(merged.cornerRadius) || 0, 0, 12),
    font: Object.hasOwn(FONT_STACKS, merged.font) ? merged.font : 'serif',
  }
}

/** Long titles shrink so they always fit on one line inside the band. */
function fitFontSize(text: string, bandHeight: number, bandWidth: number): number {
  const byHeight = bandHeight * 0.46
  const byWidth = (bandWidth * 0.9) / Math.max(text.length * 0.56, 1)
  return Math.round(Math.min(byHeight, byWidth))
}

export function frameLayout(ratio: string, frame: FrameSettings, card: Pick<Card, 'title' | 'number'>): FrameLayout {
  const { width, height } = ratioSize(ratio)
  const border = Math.round((width * frame.borderWidth) / 100)
  const innerWidth = width - 2 * border
  const hasTitle = frame.showTitle && card.title.trim().length > 0
  const hasNumber = frame.showNumber && card.number.trim().length > 0
  const titleHeight = hasTitle ? Math.round(height * TITLE_BAND) : 0
  const numberHeight = hasNumber ? Math.round(height * NUMBER_BAND) : 0

  return {
    width,
    height,
    border,
    radius: Math.round((width * frame.cornerRadius) / 100),
    image: {
      x: border,
      y: border + numberHeight,
      width: Math.max(innerWidth, 1),
      height: Math.max(height - 2 * border - titleHeight - numberHeight, 1),
    },
    title: hasTitle
      ? { x: border, y: height - border - titleHeight, width: innerWidth, height: titleHeight, fontSize: fitFontSize(card.title.trim(), titleHeight, innerWidth) }
      : null,
    number: hasNumber
      ? { x: border, y: border, width: innerWidth, height: numberHeight, fontSize: fitFontSize(card.number.trim(), numberHeight, innerWidth) }
      : null,
  }
}

export function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[char]};`)
}

interface MarkupOptions {
  /** Image to place inside the frame; omitted draws an empty frame. */
  imageUrl?: string
  /** Fluid fills its container (display); intrinsic has pixel dimensions (export). */
  sizing: 'fluid' | 'intrinsic'
}

/** One SVG drawing used both on screen and for export, so both always match. */
export function framedSvgMarkup(ratio: string, frame: FrameSettings, card: Pick<Card, 'title' | 'number'>, options: MarkupOptions): string {
  const layout = frameLayout(ratio, frame, card)
  const { width, height, image } = layout
  const font = escapeXml(FONT_STACKS[frame.font])
  const size = options.sizing === 'fluid' ? 'width="100%" height="100%"' : `width="${width}" height="${height}"`
  const line = Math.max(Math.round(width * 0.004), 1)
  const text = (rect: FrameLayout['title'], value: string) =>
    rect
      ? `<text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2}" font-family="${font}" font-size="${rect.fontSize}" fill="${frame.textColor}" text-anchor="middle" dominant-baseline="central" letter-spacing="${Math.round(rect.fontSize * 0.06)}">${escapeXml(value.trim())}</text>`
      : ''

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ${size} preserveAspectRatio="xMidYMid meet">`,
    `<rect width="${width}" height="${height}" rx="${layout.radius}" fill="${frame.borderColor}"/>`,
    `<rect x="${layout.border}" y="${layout.border}" width="${width - 2 * layout.border}" height="${height - 2 * layout.border}" fill="${frame.backgroundColor}"/>`,
    options.imageUrl
      ? `<image href="${escapeXml(options.imageUrl)}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" preserveAspectRatio="xMidYMid slice"/>`
      : '',
    `<rect x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" fill="none" stroke="${frame.textColor}" stroke-opacity="0.6" stroke-width="${line}"/>`,
    text(layout.number, card.number),
    text(layout.title, card.title),
    '</svg>',
  ].join('')
}
