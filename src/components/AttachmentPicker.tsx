import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import type { Attachment } from '../types'
import { ACCEPTED_FILE_TYPES, MAX_ATTACHMENTS, formatBytes } from '../lib/attachments'

interface AttachmentPickerProps {
  attachments: Attachment[]
  errors: string[]
  isReading: boolean
  disabled?: boolean
  onAddFiles: (files: File[]) => void
  onRemove: (id: string) => void
}

function AttachmentIcon({ kind }: { kind: Attachment['kind'] }) {
  if (kind === 'pdf') {
    return (
      <svg className="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function AttachmentPicker({
  attachments,
  errors,
  isReading,
  disabled,
  onAddFiles,
  onRemove,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isFull = attachments.length >= MAX_ATTACHMENTS

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    onAddFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    onAddFiles(Array.from(e.dataTransfer.files))
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  return (
    <div className="space-y-2">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setIsDragging(false)}
        className={`rounded-xl border border-dashed px-4 py-3 transition-colors ${
          isDragging ? 'border-violet-500 bg-violet-500/5' : 'border-zinc-700 bg-zinc-800/40'
        }`}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-zinc-500">
            Drop, paste, or browse images and reference documents (PDF, txt, md, csv, json) — sent to the model with
            your prompt.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || isFull || isReading}
            className="text-xs text-violet-400 hover:text-violet-300 border border-violet-500/40 hover:border-violet-400 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isReading ? 'Reading…' : 'Add files'}
          </button>
        </div>

        {attachments.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-3">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg pl-2 pr-1 py-1"
              >
                {attachment.kind === 'image' ? (
                  <img
                    src={attachment.data}
                    alt=""
                    className="w-7 h-7 rounded object-cover border border-zinc-700"
                  />
                ) : (
                  <AttachmentIcon kind={attachment.kind} />
                )}
                <span className="text-xs text-zinc-300 max-w-[10rem] truncate" title={attachment.name}>
                  {attachment.name}
                </span>
                <span className="text-[10px] text-zinc-600 font-mono">{formatBytes(attachment.size)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(attachment.id)}
                  disabled={disabled}
                  aria-label={`Remove ${attachment.name}`}
                  className="text-zinc-500 hover:text-red-400 disabled:opacity-40 p-1 rounded transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {errors.map((message) => (
        <p key={message} className="text-xs text-red-400">
          {message}
        </p>
      ))}
    </div>
  )
}
