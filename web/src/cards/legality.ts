import type { Card } from './types.ts'

/**
 * Regulation marks are single letters that increase over time (G, H, I, J, …), so letter
 * order is release order.
 */
export function compareMarks(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** True when the mark is at or above the oldest legal mark. */
export function markIsLegal(mark: string, oldestLegalMark: string): boolean {
  return compareMarks(mark, oldestLegalMark) >= 0
}

/**
 * Standard legality. A card is legal when any print of it (reprints count, since they are
 * collapsed into one card) carries a legal mark. Basic Energy is always legal.
 */
export function isStandardLegal(card: Card, oldestLegalMark: string): boolean {
  if (card.kind === 'energy' && card.basic) return true
  return card.mark !== null && markIsLegal(card.mark, oldestLegalMark)
}
