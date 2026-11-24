import { describe, it, expect } from 'vitest'
import { DEFAULT_FRAME, escapeXml, frameLayout, framedSvgMarkup, ratioSize, sanitizeFrame } from '../workspace/frame'
import { exportFileName, printSheetHtml, slugify } from '../workspace/exportCards'
import { crc32, createZip, createZipParts } from '../lib/zip'
import { PRESETS, isPresetId, missingPresetCards } from '../workspace/presets'

const frame = { ...DEFAULT_FRAME, enabled: true }
const card = { title: 'The Fool', number: '0' }

describe('frame layout', () => {
  it('sizes the drawing from the ratio and falls back to square', () => {
    expect(ratioSize('2:3')).toEqual({ width: 1000, height: 1500 })
    expect(ratioSize('auto')).toEqual({ width: 1000, height: 1000 })
  })

  it('stacks number band, image and title band inside the border', () => {
    const layout = frameLayout('2:3', frame, card)
    expect(layout.border).toBe(40)
    expect(layout.number).toMatchObject({ y: 40, height: 113 })
    expect(layout.image.y).toBe(40 + 113)
    expect(layout.title!.y + layout.title!.height).toBe(1500 - 40)
    expect(layout.image.y + layout.image.height).toBe(layout.title!.y)
  })

  it('gives the image the whole inside when title and number are hidden or empty', () => {
    const layout = frameLayout('1:1', { ...frame, showTitle: false }, { title: 'x', number: ' ' })
    expect(layout.title).toBeNull()
    expect(layout.number).toBeNull()
    expect(layout.image).toEqual({ x: 40, y: 40, width: 920, height: 920 })
  })

  it('shrinks long titles to fit the band width', () => {
    const short = frameLayout('2:3', frame, { title: 'Sun', number: '' }).title!.fontSize
    const long = frameLayout('2:3', frame, { title: 'Queen of Pentacles and other long words', number: '' }).title!.fontSize
    expect(long).toBeLessThan(short)
  })

  it('sanitises colors, ranges and fonts', () => {
    expect(sanitizeFrame({ borderColor: 'red', borderWidth: 99, font: 'comic' as never })).toMatchObject({
      borderColor: DEFAULT_FRAME.borderColor,
      borderWidth: 12,
      font: 'serif',
    })
  })
})

describe('framedSvgMarkup', () => {
  it('escapes titles and image urls', () => {
    const markup = framedSvgMarkup('2:3', frame, { title: '<Fool & "Co">', number: 'I' }, { imageUrl: 'blob:x?a=1&b=2', sizing: 'intrinsic' })
    expect(markup).toContain('&lt;Fool &amp; &quot;Co&quot;&gt;')
    expect(markup).toContain('href="blob:x?a=1&amp;b=2"')
    expect(markup).toContain('width="1000" height="1500"')
    expect(markup).not.toContain('<Fool')
  })

  it('draws an empty frame without an image', () => {
    expect(framedSvgMarkup('1:1', frame, card, { sizing: 'fluid' })).not.toContain('<image')
    expect(escapeXml(`'`)).toBe('&apos;')
  })
})

describe('export naming', () => {
  it('slugifies accents and symbols', () => {
    expect(slugify('Reine d’Épées #3')).toBe('reine-d-epees-3')
    expect(exportFileName(0, { title: 'The Fool', number: '0' }, 'png')).toBe('001-0-the-fool.png')
    expect(exportFileName(11, { title: 'Ace of Cups', number: '' }, 'svg')).toBe('012-ace-of-cups.svg')
  })

  it('lays out a print sheet at physical size', () => {
    const html = printSheetHtml('Deck <1>', ['data:image/png;base64,AA'], '2:3', 70)
    expect(html).toContain('width:70mm;height:105mm')
    expect(html).toContain('<title>Deck &lt;1&gt;</title>')
    expect(html).toContain('window.print()')
  })
})

describe('createZip', () => {
  it('returns the same bytes as parts', () => {
    const entries = [{ name: 'a', data: new Uint8Array([7]) }]
    const joined = createZipParts(entries).flatMap((part) => [...part])
    expect(new Uint8Array(joined)).toEqual(createZip(entries))
  })

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
  })

  it('writes local headers, a central directory and the end record', () => {
    const zip = createZip([
      { name: 'a.txt', data: new TextEncoder().encode('hello') },
      { name: 'é.txt', data: new Uint8Array([1, 2, 3]) },
    ])
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    const end = zip.length - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)
    const centralOffset = view.getUint32(end + 16, true)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
    expect(view.getUint32(centralOffset + 16, true)).toBe(0x3610a686)
  })
})

describe('presets', () => {
  it('lists the 22 major arcana and the full 78-card deck', () => {
    const major = PRESETS['tarot-major'].cards()
    expect(major).toHaveLength(22)
    expect(major[0]).toMatchObject({ number: '0', title: 'The Fool' })
    expect(major[21]).toMatchObject({ number: 'XXI', title: 'The World' })
    const full = PRESETS['tarot-full'].cards()
    expect(full).toHaveLength(78)
    expect(new Set(full.map((c) => c.title)).size).toBe(78)
    expect(full.find((c) => c.title === 'King of Pentacles')).toBeDefined()
    expect(isPresetId('tarot-full')).toBe(true)
    expect(isPresetId('toString')).toBe(false)
  })

  it('only adds the preset items that are not there yet', () => {
    const added = missingPresetCards('tarot-full', ['the fool', ' The Magician '])
    expect(added).toHaveLength(76)
    expect(added.some((c) => c.title === 'The Fool')).toBe(false)
  })
})
