/**
 * Format a number with SI suffixes.
 * Examples: 1234 -> "1.23k", 1_500_000 -> "1.50M"
 */
export function fmt(n: number): string {
  if (!isFinite(n)) return String(n)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''

  if (abs < 1_000) {
    return sign + (abs % 1 === 0 ? abs.toString() : abs.toFixed(2))
  }

  const tiers: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9,  'G'],
    [1e6,  'M'],
    [1e3,  'k'],
  ]

  for (const [threshold, suffix] of tiers) {
    if (abs >= threshold) {
      return sign + (abs / threshold).toFixed(2) + suffix
    }
  }

  return sign + abs.toString()
}

/**
 * Format a duration in seconds into a human-readable string.
 * Examples: 3600 -> "1h 0m", 13320 -> "3h 42m", 45 -> "45s"
 */
export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '--'

  const s = Math.floor(sec)

  const days    = Math.floor(s / 86_400)
  const hours   = Math.floor((s % 86_400) / 3_600)
  const minutes = Math.floor((s % 3_600)  / 60)
  const seconds = s % 60

  if (days > 0)   return `${days}d ${hours}h`
  if (hours > 0)  return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
