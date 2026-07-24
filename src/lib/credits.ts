const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

export interface KeyCredits {
  label: string
  /** Credits spent by this key, all time. */
  usage: number | null
  /** Spending cap on the key, null when uncapped. */
  limit: number | null
  limitRemaining: number | null
  /** Account-wide totals; absent for keys that cannot read them. */
  totalCredits: number | null
  totalUsage: number | null
  isFreeTier: boolean
}

interface KeyResponse {
  data?: {
    label?: string
    usage?: number
    limit?: number | null
    limit_remaining?: number | null
    is_free_tier?: boolean
  }
}

interface CreditsResponse {
  data?: {
    total_credits?: number
    total_usage?: number
  }
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * What is left to spend: a per-key cap wins when set, otherwise the account
 * balance. Null when neither is known (uncapped key without account access).
 */
export function remainingCredits(credits: KeyCredits): number | null {
  if (credits.limitRemaining !== null) return credits.limitRemaining
  if (credits.totalCredits !== null && credits.totalUsage !== null) {
    return credits.totalCredits - credits.totalUsage
  }
  return null
}

async function getJson<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) {
    throw new Error(`Failed to read credits: ${response.status}`)
  }
  return response.json() as Promise<T>
}

/**
 * Reads key limits and, when the key allows it, the account balance. The account
 * call is optional so a restricted key still reports its own usage.
 */
export async function fetchCredits(apiKey: string): Promise<KeyCredits> {
  const [key, account] = await Promise.all([
    getJson<KeyResponse>('/key', apiKey),
    getJson<CreditsResponse>('/credits', apiKey).catch(() => ({}) as CreditsResponse),
  ])

  return {
    label: key.data?.label ?? '',
    usage: toNumber(key.data?.usage),
    limit: toNumber(key.data?.limit),
    limitRemaining: toNumber(key.data?.limit_remaining),
    totalCredits: toNumber(account.data?.total_credits),
    totalUsage: toNumber(account.data?.total_usage),
    isFreeTier: Boolean(key.data?.is_free_tier),
  }
}
