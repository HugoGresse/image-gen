import { describe, it, expect } from 'vitest'
import { buildUserContent } from '../lib/openrouter'
import type { Attachment } from '../types'

function attachment(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'a1',
    name: 'file',
    mimeType: 'text/plain',
    size: 10,
    kind: 'text',
    data: '',
    ...overrides,
  }
}

describe('buildUserContent', () => {
  it('returns the plain prompt when nothing is attached', () => {
    expect(buildUserContent('a neon city')).toBe('a neon city')
    expect(buildUserContent('a neon city', [])).toBe('a neon city')
  })

  it('sends uploaded images as image_url parts before the prompt text', () => {
    const content = buildUserContent('match this style', [
      attachment({ kind: 'image', name: 'ref.png', data: 'data:image/png;base64,AAAA' }),
    ])
    expect(content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'text', text: 'match this style' },
    ])
  })

  it('sends PDFs as file parts with their filename', () => {
    const content = buildUserContent('follow the brief', [
      attachment({ kind: 'pdf', name: 'brief.pdf', data: 'data:application/pdf;base64,BBBB' }),
    ])
    expect(content).toEqual([
      { type: 'file', file: { filename: 'brief.pdf', file_data: 'data:application/pdf;base64,BBBB' } },
      { type: 'text', text: 'follow the brief' },
    ])
  })

  it('inlines text documents as labelled reference blocks after the prompt', () => {
    const content = buildUserContent('use the palette', [
      attachment({ kind: 'text', name: 'palette.md', data: '  violet, zinc  ' }),
    ])
    expect(content).toEqual([
      { type: 'text', text: 'use the palette\n\n--- Reference document: palette.md ---\nviolet, zinc' },
    ])
  })

  it('ignores empty text documents', () => {
    const content = buildUserContent('a neon city', [attachment({ kind: 'text', name: 'empty.txt', data: '   ' })])
    expect(content).toEqual([{ type: 'text', text: 'a neon city' }])
  })

  it('combines images, PDFs, and text documents in one message', () => {
    const content = buildUserContent('a neon city', [
      attachment({ id: 'a1', kind: 'image', name: 'ref.png', data: 'data:image/png;base64,AAAA' }),
      attachment({ id: 'a2', kind: 'pdf', name: 'brief.pdf', data: 'data:application/pdf;base64,BBBB' }),
      attachment({ id: 'a3', kind: 'text', name: 'notes.txt', data: 'keep it moody' }),
    ])
    expect(content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } },
      { type: 'file', file: { filename: 'brief.pdf', file_data: 'data:application/pdf;base64,BBBB' } },
      { type: 'text', text: 'a neon city\n\n--- Reference document: notes.txt ---\nkeep it moody' },
    ])
  })
})
