import type { Attachment, AttachmentKind } from '../types'

export const MAX_ATTACHMENTS = 8
export const MAX_FILE_BYTES = 10 * 1024 * 1024
/** Reference documents are inlined into the prompt, so cap how much text we send. */
export const MAX_TEXT_CHARS = 20_000

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.yaml', '.yml']

export const ACCEPTED_FILE_TYPES = `image/*,application/pdf,${TEXT_EXTENSIONS.join(',')}`

function hasTextExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** Returns the attachment kind for a file, or null when the type is unsupported. */
export function classifyFile(file: File): AttachmentKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return 'pdf'
  if (file.type.startsWith('text/') || file.type === 'application/json' || hasTextExtension(file.name)) return 'text'
  return null
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Drops the payload so sessions can keep attachment metadata without holding base64 blobs. */
export function stripAttachmentData(attachment: Attachment): Attachment {
  return { ...attachment, data: '' }
}

const BASE64_CHUNK_SIZE = 0x8000

async function readAsDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK_SIZE))
  }
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

/**
 * Reads a picked file into an Attachment: images and PDFs become data URLs,
 * text documents are decoded and truncated so they can be inlined in the prompt.
 * Throws when the file is unsupported or too large.
 */
export async function readAttachment(file: File): Promise<Attachment> {
  const kind = classifyFile(file)
  if (!kind) {
    throw new Error(`${file.name}: unsupported file type. Use an image, a PDF, or a text document.`)
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_FILE_BYTES)}.`)
  }

  const data = kind === 'text' ? (await file.text()).slice(0, MAX_TEXT_CHARS) : await readAsDataUrl(file)

  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || kind,
    size: file.size,
    kind,
    data,
  }
}

/**
 * Reads every picked file, keeping the successful ones and collecting one error
 * message per rejected file so the UI can report them together.
 */
export async function readAttachments(
  files: File[],
  existingCount = 0
): Promise<{ attachments: Attachment[]; errors: string[] }> {
  const room = Math.max(MAX_ATTACHMENTS - existingCount, 0)
  const errors: string[] = []

  if (files.length > room) {
    errors.push(`Only ${MAX_ATTACHMENTS} attachments allowed — extra files were ignored.`)
  }

  const results = await Promise.allSettled(files.slice(0, room).map(readAttachment))
  const attachments = results
    .filter((r): r is PromiseFulfilledResult<Attachment> => r.status === 'fulfilled')
    .map((r) => r.value)

  for (const result of results) {
    if (result.status === 'rejected') {
      errors.push(result.reason instanceof Error ? result.reason.message : 'Could not read a file.')
    }
  }

  return { attachments, errors }
}
