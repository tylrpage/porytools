import { beforeEach, describe, expect, it } from 'vitest'
import { computeDeal, deal, dealCache, type DealSizes, type Pile, type Tracker } from './deal.ts'

const sizes: DealSizes = { hand: 7, prizes: 6, drawn: 2 }
// 4 of group 0, 10 Basics (group 1, 2 of them also in group 0), the rest in nothing.
const piles: Pile[] = [
  { count: 2, groups: 0b01 },
  { count: 2, groups: 0b11 },
  { count: 8, groups: 0b10 },
  { count: 48, groups: 0 },
]
const trackers: Tracker[] = [
  { group: 0, zones: ['hand', 'drawn'], cap: 2 },
  { group: 1, zones: ['hand'], cap: 1 },
]

describe('deal cache', () => {
  beforeEach(() => dealCache.clear())

  it('gives the same outcomes as the uncached deal', () => {
    expect(deal(piles, sizes, trackers)).toEqual(computeDeal(piles, sizes, trackers))
  })

  it('answers a repeated deal from the cache', () => {
    const first = deal(piles, sizes, trackers)
    expect(dealCache.size).toBe(1)
    expect(deal(piles, sizes, trackers)).toBe(first)
    expect(dealCache.size).toBe(1)
  })

  it('shares one entry for the same piles in another order or split', () => {
    const first = deal(piles, sizes, trackers)
    const shuffled = [piles[3], piles[1], piles[0], piles[2]]
    expect(deal(shuffled, sizes, trackers)).toBe(first)
    // The 48 "other" cards as two piles: the same deal.
    const split = [...piles.slice(0, 3), { count: 20, groups: 0 }, { count: 28, groups: 0 }]
    expect(deal(split, sizes, trackers)).toBe(first)
    expect(dealCache.size).toBe(1)
  })

  it('keeps deals apart when anything they depend on differs', () => {
    deal(piles, sizes, trackers)
    deal(piles, { ...sizes, drawn: 3 }, trackers)
    deal(piles, sizes, [{ ...trackers[0], cap: 1 }, trackers[1]])
    deal(piles, sizes, [{ ...trackers[0], zones: ['prizes'] }, trackers[1]])
    deal(
      [{ count: 3, groups: 0b01 }, ...piles.slice(1, 3), { count: 47, groups: 0 }],
      sizes,
      trackers,
    )
    expect(dealCache.size).toBe(5)
    // And each cached answer is still that deal's own.
    const other = { ...sizes, drawn: 3 }
    expect(deal(piles, other, trackers)).toEqual(computeDeal(piles, other, trackers))
  })

  it('stays bounded', () => {
    for (let drawn = 0; drawn < 2100; drawn++) {
      deal(
        [
          { count: 1, groups: 1 },
          { count: 2200, groups: 0 },
        ],
        { hand: 0, prizes: 0, drawn },
        [{ group: 0, zones: ['drawn'], cap: 1 }],
      )
    }
    expect(dealCache.size).toBeLessThanOrEqual(2000)
  })
})
