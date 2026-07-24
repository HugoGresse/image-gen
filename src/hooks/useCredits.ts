import { useCallback, useEffect, useState } from 'react'
import { fetchCredits } from '../lib/credits'
import type { KeyCredits } from '../lib/credits'

/**
 * Reads the key's credit standing. Refetches when the key changes and on demand
 * after a generation, since the balance only moves once OpenRouter has billed.
 */
export function useCredits(apiKey: string) {
  const [credits, setCredits] = useState<KeyCredits | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(apiKey))
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!apiKey) return
    let cancelled = false

    fetchCredits(apiKey)
      .then((next) => {
        if (cancelled) return
        setCredits(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setCredits(null)
        setError(err instanceof Error ? err.message : 'Could not read credits.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [apiKey, reloadToken])

  const refresh = useCallback(() => {
    setIsLoading(true)
    setReloadToken((token) => token + 1)
  }, [])

  // A key that has been removed has no standing to report.
  return {
    credits: apiKey ? credits : null,
    isLoading: apiKey ? isLoading : false,
    error: apiKey ? error : null,
    refresh,
  }
}
