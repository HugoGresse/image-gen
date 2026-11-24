import { useEffect, useState } from 'react'
import { imageUrl } from '../workspace/images'

export function useStoredImageUrl(id: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<{ id: string; url: string | undefined } | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    imageUrl(id)
      .then((url) => {
        if (!cancelled) setResolved({ id, url })
      })
      .catch(() => {
        if (!cancelled) setResolved({ id, url: undefined })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return resolved && resolved.id === id ? resolved.url : undefined
}
