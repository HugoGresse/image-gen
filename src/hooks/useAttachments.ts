import { useCallback, useState } from 'react'
import type { Attachment } from '../types'
import { MAX_ATTACHMENTS, readAttachments } from '../lib/attachments'

/** Owns the attachment list for a prompt: reading picked files, errors, removal. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isReading, setIsReading] = useState(false)

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return
      setIsReading(true)
      try {
        const result = await readAttachments(files, attachments.length)
        setAttachments((prev) => [...prev, ...result.attachments].slice(0, MAX_ATTACHMENTS))
        setErrors(result.errors)
      } finally {
        setIsReading(false)
      }
    },
    [attachments.length]
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    setErrors([])
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
    setErrors([])
  }, [])

  return { attachments, errors, isReading, addFiles, removeAttachment, clearAttachments }
}
