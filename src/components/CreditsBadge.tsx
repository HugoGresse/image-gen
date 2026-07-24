import type { KeyCredits } from '../lib/credits'
import { remainingCredits } from '../lib/credits'
import { formatCost } from '../lib/money'

interface CreditsBadgeProps {
  credits: KeyCredits | null
  isLoading: boolean
  error: string | null
  onRefresh: () => void
}

function detail(credits: KeyCredits): string {
  const parts = [
    credits.usage !== null ? `${formatCost(credits.usage)} used by this key` : null,
    credits.limit !== null ? `key cap ${formatCost(credits.limit)}` : null,
    credits.totalCredits !== null ? `${formatCost(credits.totalCredits)} purchased` : null,
    credits.isFreeTier ? 'free tier' : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

/** Shows what the key has left to spend, falling back to what it has spent. */
export function CreditsBadge({ credits, isLoading, error, onRefresh }: CreditsBadgeProps) {
  if (error) {
    return (
      <button
        onClick={onRefresh}
        title={error}
        className="text-xs text-amber-400/80 hover:text-amber-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg transition-colors"
      >
        Credits unavailable
      </button>
    )
  }

  if (!credits) {
    return isLoading ? <span className="text-xs text-zinc-600 px-2.5 py-1">Reading credits…</span> : null
  }

  const remaining = remainingCredits(credits)
  const label = remaining !== null ? `${formatCost(remaining)} left` : `${formatCost(credits.usage) ?? '—'} used`

  return (
    <button
      onClick={onRefresh}
      title={`${detail(credits)} — click to refresh`}
      className="text-xs bg-zinc-900 border border-zinc-800 hover:border-zinc-600 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5"
    >
      <svg
        className={`w-3.5 h-3.5 text-violet-400 ${isLoading ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        {isLoading ? (
          <path d="M21 12a9 9 0 11-6.22-8.56" strokeLinecap="round" />
        ) : (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M14.5 9.5a3 3 0 100 5" strokeLinecap="round" />
          </>
        )}
      </svg>
      <span className="text-zinc-300 font-mono">{label}</span>
    </button>
  )
}
