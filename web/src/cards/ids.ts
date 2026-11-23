// Print IDs follow PTCG Live: set code + collector number, e.g. "TWM-128", "PR-SV-12",
// "30C-127". Numbers drop leading zeros, so "SVP 007" and "SVP 7" are the same print.

export function normalizeNumber(number: string): string {
  return number
    .trim()
    .replace(/^0+(?=\w)/, '')
    .toUpperCase()
}

export function printId(code: string, number: string): string {
  return `${code.toUpperCase()}-${normalizeNumber(number)}`
}

/** Codes can contain dashes ("PR-SV"); numbers can't, so split at the last one. */
export function splitPrintId(id: string): { code: string; number: string } {
  const dash = id.lastIndexOf('-')
  return { code: id.slice(0, dash), number: id.slice(dash + 1) }
}

/** "TWM-128" → "TWM 128", as decklists write it. */
export function printLabel(id: string): string {
  const { code, number } = splitPrintId(id)
  return `${code} ${number}`
}
