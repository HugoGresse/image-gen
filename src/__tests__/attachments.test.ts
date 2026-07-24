import { describe, it, expect } from 'vitest'
import {
  MAX_ATTACHMENTS,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  classifyFile,
  formatBytes,
  readAttachment,
  readAttachments,
  stripAttachmentData,
} from '../lib/attachments'
import type { Attachment } from '../types'

function makeFile(name: string, type: string, content = 'hello', size?: number): File {
  const file = new File([content], name, { type })
  if (size !== undefined) {
    Object.defineProperty(file, 'size', { value: size })
  }
  return file
}

describe('classifyFile', () => {
  it('classifies images by mime type', () => {
    expect(classifyFile(makeFile('shot.png', 'image/png'))).toBe('image')
    expect(classifyFile(makeFile('photo.webp', 'image/webp'))).toBe('image')
  })

  it('classifies PDFs by mime type or extension', () => {
    expect(classifyFile(makeFile('brief.pdf', 'application/pdf'))).toBe('pdf')
    expect(classifyFile(makeFile('brief.PDF', ''))).toBe('pdf')
  })

  it('classifies text documents by mime type or extension', () => {
    expect(classifyFile(makeFile('notes.txt', 'text/plain'))).toBe('text')
    expect(classifyFile(makeFile('spec.md', ''))).toBe('text')
    expect(classifyFile(makeFile('data.json', 'application/json'))).toBe('text')
    expect(classifyFile(makeFile('rows.csv', ''))).toBe('text')
  })

  it('rejects unsupported types', () => {
    expect(classifyFile(makeFile('archive.zip', 'application/zip'))).toBeNull()
    expect(classifyFile(makeFile('clip.mp4', 'video/mp4'))).toBeNull()
  })
})

describe('formatBytes', () => {
  it('formats bytes, kilobytes, and megabytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('readAttachment', () => {
  it('reads a text document as decoded content', async () => {
    const attachment = await readAttachment(makeFile('spec.md', 'text/markdown', '# Brand guide'))
    expect(attachment.kind).toBe('text')
    expect(attachment.data).toBe('# Brand guide')
  })

  it('truncates oversized text documents', async () => {
    const long = 'a'.repeat(MAX_TEXT_CHARS + 500)
    const attachment = await readAttachment(makeFile('long.txt', 'text/plain', long))
    expect(attachment.data).toHaveLength(MAX_TEXT_CHARS)
  })

  it('reads an image as a data URL', async () => {
    const attachment = await readAttachment(makeFile('shot.png', 'image/png', 'binary'))
    expect(attachment.kind).toBe('image')
    expect(attachment.data.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rejects unsupported file types', async () => {
    await expect(readAttachment(makeFile('archive.zip', 'application/zip'))).rejects.toThrow('unsupported file type')
  })

  it('rejects files over the size limit', async () => {
    const big = makeFile('huge.png', 'image/png', 'x', MAX_FILE_BYTES + 1)
    await expect(readAttachment(big)).rejects.toThrow('the limit is')
  })
})

describe('readAttachments', () => {
  it('keeps readable files and reports one error per rejected file', async () => {
    const { attachments, errors } = await readAttachments([
      makeFile('notes.txt', 'text/plain', 'ok'),
      makeFile('archive.zip', 'application/zip'),
    ])
    expect(attachments).toHaveLength(1)
    expect(attachments[0].name).toBe('notes.txt')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('archive.zip')
  })

  it('caps the batch at the remaining attachment slots', async () => {
    const files = Array.from({ length: 3 }, (_, i) => makeFile(`doc-${i}.txt`, 'text/plain', 'x'))
    const { attachments, errors } = await readAttachments(files, MAX_ATTACHMENTS - 1)
    expect(attachments).toHaveLength(1)
    expect(errors[0]).toContain(`Only ${MAX_ATTACHMENTS} attachments allowed`)
  })
})

describe('stripAttachmentData', () => {
  it('clears the payload but keeps metadata', () => {
    const attachment: Attachment = {
      id: 'a1',
      name: 'shot.png',
      mimeType: 'image/png',
      size: 1024,
      kind: 'image',
      data: 'data:image/png;base64,AAAA',
    }
    expect(stripAttachmentData(attachment)).toEqual({ ...attachment, data: '' })
  })
})
