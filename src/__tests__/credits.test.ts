import { describe, it, expect, vi } from 'vitest'
import { fetchCredits, remainingCredits } from '../lib/credits'
import type { KeyCredits } from '../lib/credits'
import { formatCost } from '../lib/money'

function credits(overrides: Partial<KeyCredits> = {}): KeyCredits {
  return {
    label: 'Image Gen',
    usage: 1.5,
    limit: null,
    limitRemaining: null,
    totalCredits: null,
    totalUsage: null,
    isFreeTier: false,
    ...overrides,
  }
}

describe('remainingCredits', () => {
  it('prefers the key cap when one is set', () => {
    expect(remainingCredits(credits({ limitRemaining: 3.25, totalCredits: 100, totalUsage: 10 }))).toBe(3.25)
  })

  it('falls back to the account balance', () => {
    expect(remainingCredits(credits({ totalCredits: 20, totalUsage: 4.5 }))).toBe(15.5)
  })

  it('returns null when neither is known', () => {
    expect(remainingCredits(credits())).toBeNull()
  })

  it('can report an overdrawn balance', () => {
    expect(remainingCredits(credits({ totalCredits: 5, totalUsage: 7 }))).toBe(-2)
  })
})

describe('fetchCredits', () => {
  function stub(keyPayload: unknown, creditsPayload: unknown, creditsOk = true) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/key')
            ? { ok: true, json: () => Promise.resolve(keyPayload) }
            : { ok: creditsOk, status: 403, json: () => Promise.resolve(creditsPayload) }
        )
      )
    )
  }

  it('reads key limits and the account balance', async () => {
    stub(
      { data: { label: 'Image Gen', usage: 2.5, limit: 10, limit_remaining: 7.5, is_free_tier: false } },
      { data: { total_credits: 20, total_usage: 2.5 } }
    )
    await expect(fetchCredits('sk-or-test')).resolves.toEqual({
      label: 'Image Gen',
      usage: 2.5,
      limit: 10,
      limitRemaining: 7.5,
      totalCredits: 20,
      totalUsage: 2.5,
      isFreeTier: false,
    })
  })

  it('still reports key usage when the account endpoint is not allowed', async () => {
    stub({ data: { label: 'Restricted', usage: 0.4 } }, {}, false)
    const result = await fetchCredits('sk-or-test')
    expect(result).toMatchObject({ usage: 0.4, totalCredits: null, totalUsage: null })
  })

  it('normalises missing numeric fields to null', async () => {
    stub({ data: { label: 'Uncapped', usage: 1, limit: null } }, { data: {} })
    const result = await fetchCredits('sk-or-test')
    expect(result).toMatchObject({ limit: null, limitRemaining: null, totalCredits: null })
  })

  it('rejects when the key endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(fetchCredits('bad-key')).rejects.toThrow('Failed to read credits: 401')
  })
})

describe('formatCost', () => {
  it('scales precision to the amount', () => {
    expect(formatCost(12.3456)).toBe('$12.35')
    expect(formatCost(0.42)).toBe('$0.42')
    expect(formatCost(0.006216705)).toBe('$0.0062')
    expect(formatCost(0)).toBe('$0')
  })

  it('returns null for unknown amounts', () => {
    expect(formatCost(null)).toBeNull()
    expect(formatCost(undefined)).toBeNull()
    expect(formatCost(Number.NaN)).toBeNull()
  })
})
