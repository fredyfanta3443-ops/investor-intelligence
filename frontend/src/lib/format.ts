/**
 * Metrics from the API are raw numbers in millions of dollars, and may be
 * null when extraction didn't find a value. The backend's extraction model
 * allows either a string or a number for these fields (the LLM's output
 * type isn't fully constrained), so the same field can come back as
 * `391035` for one company and `"391035"` for another — accept both.
 */
export function formatMillions(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A'
  if (typeof value === 'string' && value.trim() === '') return 'N/A'
  const num = Number(value)
  if (Number.isNaN(num)) return 'N/A'

  const abs = Math.abs(num)
  const sign = num < 0 ? '-' : ''

  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}T`
  if (abs >= 1_000) return `${sign}$${(abs / 1000).toFixed(2)}B`
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}M`
}

/** risk_factors / growth_drivers come back as newline-separated strings. */
export function parseLines(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
