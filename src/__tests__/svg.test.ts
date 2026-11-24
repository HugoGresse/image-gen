import { describe, it, expect } from 'vitest'
import { decodeSvgDataUrl, fitSize, svgSize, withSize } from '../lib/svg'

const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))

describe('decodeSvgDataUrl', () => {
  it('decodes base64 data URLs as UTF-8', () => {
    const markup = '<svg><text>café</text></svg>'
    expect(decodeSvgDataUrl(`data:image/svg+xml;base64,${toBase64(markup)}`)).toBe(markup)
  })

  it('decodes percent-encoded data URLs', () => {
    expect(decodeSvgDataUrl('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')).toBe('<svg/>')
  })
})

describe('svgSize', () => {
  it('reads absolute width and height', () => {
    expect(svgSize('<svg width="200px" height="100" viewBox="0 0 20 10">')).toEqual({ width: 200, height: 100 })
  })

  it('falls back to the viewBox for relative or missing lengths', () => {
    expect(svgSize('<svg width="100%" viewBox="0 0 1600 900">')).toEqual({ width: 1600, height: 900 })
    expect(svgSize('<svg viewBox="0,0,30,40">')).toEqual({ width: 30, height: 40 })
  })

  it('ignores stroke-width and returns null when nothing is declared', () => {
    expect(svgSize('<svg stroke-width="3">')).toBeNull()
    expect(svgSize('<p>not svg</p>')).toBeNull()
  })
})

describe('fitSize', () => {
  it('scales small sizes up to the minimum long side', () => {
    expect(fitSize({ width: 100, height: 50 }, 1024, 2048)).toEqual({ width: 1024, height: 512 })
  })

  it('scales huge sizes down to the maximum long side', () => {
    expect(fitSize({ width: 9000, height: 3000 }, 1024, 2048)).toEqual({ width: 2048, height: 683 })
  })

  it('keeps sizes already in range and squares unknown ones', () => {
    expect(fitSize({ width: 1200, height: 800 }, 1024, 2048)).toEqual({ width: 1200, height: 800 })
    expect(fitSize(null, 1024, 2048)).toEqual({ width: 1024, height: 1024 })
  })
})

describe('withSize', () => {
  it('replaces the root size and keeps an existing viewBox', () => {
    const sized = withSize('<svg viewBox="0 0 16 9" width="16"><rect width="5"/></svg>', { width: 1600, height: 900 })
    expect(sized).toBe('<svg width="1600" height="900" viewBox="0 0 16 9"><rect width="5"/></svg>')
  })

  it('adds a viewBox from the original size so content scales', () => {
    const sized = withSize('<svg width="10" height="20"/>', { width: 1024, height: 2048 })
    expect(sized).toBe('<svg width="1024" height="2048" viewBox="0 0 10 20"/>')
  })
})
