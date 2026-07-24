/** Compact dollar amount: keeps small generation costs readable without noise. */
export function formatUsd(amount: number): string {
  if (amount >= 1) return `$${Number(amount.toFixed(2))}`
  return `$${Number(amount.toPrecision(2))}`
}

/**
 * Costs run from a fraction of a cent to a few dollars, so precision follows the
 * magnitude instead of a fixed number of decimals.
 */
export function formatCost(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return null
  if (amount === 0) return '$0'
  if (amount >= 1) return `$${amount.toFixed(2)}`
  if (amount >= 0.01) return `$${amount.toFixed(2)}`
  return `$${Number(amount.toFixed(4))}`
}
