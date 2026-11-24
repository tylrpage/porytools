// Card images. The site never hosts them: each card links to one small scan on a CDN.
// TCGdex (assets.tcgdex.net, ~15 KB webp) comes first; the source's own image
// (images.pokemontcg.io, ~150 KB png, set by normalize.ts) is the fallback when TCGdex has
// no scan of any print of the card.

import { normalizeNumber, splitPrintId } from '../../src/cards/ids.ts'
import type { Card } from '../../src/cards/types.ts'
import type { TcgdexSet } from './tcgdex.ts'

export const TCGDEX_ASSETS = 'https://assets.tcgdex.net/en'

/** TCGdex sets by PTCG Live set code (several sets can share one, e.g. subsets). */
export type TcgdexIndex = Map<string, TcgdexSet[]>

export function indexTcgdexSets(sets: TcgdexSet[], aliases: Record<string, string>): TcgdexIndex {
  const index: TcgdexIndex = new Map()
  for (const set of sets) {
    const code = set.abbreviation?.official?.toUpperCase()
    if (!code || !set.serie) continue
    index.set(code, [...(index.get(code) ?? []), set])
  }
  // Decklists' alias codes ("SVP") point at our code ("PR-SV"); TCGdex may use either.
  for (const [alias, target] of Object.entries(aliases)) {
    if (!index.has(target) && index.has(alias)) index.set(target, index.get(alias)!)
  }
  return index
}

/**
 * Base URL of a print's scan on TCGdex ("…/sv/sv06/126"; append "/low.webp"), or undefined
 * when TCGdex doesn't list the print. Listing doesn't guarantee a scan exists.
 */
export function tcgdexImageBase(index: TcgdexIndex, print: string): string | undefined {
  const { code, number } = splitPrintId(print)
  for (const set of index.get(code) ?? []) {
    const card = set.cards.find((c) => normalizeNumber(c.localId) === number)
    if (card) return `${TCGDEX_ASSETS}/${set.serie!.id}/${set.id}/${card.localId}`
  }
  return undefined
}

export interface ImageStats {
  tcgdex: number
  fallback: number
  none: number
}

/**
 * Give each card the TCGdex scan of its best print that has one (prints in `preferred`
 * order, display print first). Cards without any keep the source image normalize.ts set.
 * `exists` checks a base URL (a HEAD request in the build, cached).
 */
export async function pickTcgdexImages(
  cards: Card[],
  preferred: Record<string, string[]>,
  index: TcgdexIndex,
  exists: (base: string) => Promise<boolean>,
): Promise<ImageStats> {
  const stats: ImageStats = { tcgdex: 0, fallback: 0, none: 0 }
  const pick = async (card: Card) => {
    for (const print of preferred[card.id] ?? [card.id]) {
      const base = tcgdexImageBase(index, print)
      if (base && (await exists(base))) return `${base}/low.webp`
    }
    return undefined
  }
  // A few cards at a time: the first build checks ~2,000 URLs.
  let next = 0
  const worker = async () => {
    while (next < cards.length) {
      const card = cards[next++]
      const found = await pick(card)
      if (found) {
        card.image = found
        stats.tcgdex++
      } else if (card.image) stats.fallback++
      else stats.none++
    }
  }
  await Promise.all(Array.from({ length: 16 }, worker))
  return stats
}
