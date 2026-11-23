// @vitest-environment node
// The odds engine over every real test decklist: consistent numbers and a time budget.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CardDb } from '../../src/cards/db.ts'
import type { CardData } from '../../src/cards/types.ts'
import { parseDecklist } from '../../src/deck/parse.ts'
import { builtInGroups } from '../../src/odds/groups.ts'
import { chance, drawsBy, mulliganChance, prizeDistribution } from '../../src/odds/odds.ts'

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const db = new CardDb(read('../../public/data/cards.json') as CardData)
const lists = Object.values(
  (read('../../../data/test-decklists.json') as { lists: Record<string, string[]> }).lists,
)

describe('odds on the real test decklists', () => {
  it('computes the whole odds table for every deck, quickly and consistently', () => {
    const start = performance.now()
    for (const lines of lists) {
      const deck = parseDecklist(lines.join('\n'), db).entries
      const m = mulliganChance(deck)
      expect(m).toBeGreaterThan(0)
      expect(m).toBeLessThan(0.5)
      const rows = [
        ...deck.map((e) => new Set([e.card.id])),
        ...builtInGroups(deck).map((g) => g.ids),
      ]
      for (const ids of rows) {
        const one = [{ group: ids, atLeast: 1 }]
        const ps = [0, drawsBy(1), drawsBy(2)].map((d) => chance(deck, one, d).p)
        expect(ps[0]).toBeLessThanOrEqual(ps[1] + 1e-12)
        expect(ps[1]).toBeLessThanOrEqual(ps[2] + 1e-12)
        const dist = prizeDistribution(deck, ids)
        expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9)
      }
    }
    // The page recomputes one deck's table on every change, so this is 50× that work.
    expect(performance.now() - start).toBeLessThan(4_000)
  })
})
