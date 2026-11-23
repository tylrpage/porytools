/** "42.1%", with "<0.1%" / ">99.9%" so tiny chances don't round to a misleading 0 or 100. */
export function percent(p: number): string {
  if (Number.isNaN(p)) return '—'
  if (p <= 0) return '0%'
  if (p >= 1) return '100%'
  if (p < 0.0005) return '<0.1%'
  if (p > 0.9995) return '>99.9%'
  return `${(p * 100).toFixed(1)}%`
}
