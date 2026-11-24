import { describe, expect, it } from 'vitest'
import type { Card } from '../cards/types.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { choose } from './deal.ts'
import {
  chance,
  type Condition,
  drawsBy,
  type Group,
  isBasicPokemon,
  mulliganChance,
  onlyBasicChance,
  prizeDistribution,
} from './odds.ts'

const basic = (id: string): Card => ({
  kind: 'pokemon',
  id,
  name: id,
  mark: 'H',
  prints: [id],
  stage: 'Basic',
  hp: 70,
  types: ['Psychic'],
  tags: [],
  abilities: [],
  attacks: [],
  retreat: 1,
  rules: [],
})
const stage1 = (id: string): Card => ({ ...basic(id), stage: 'Stage 1' }) as Card
const item = (id: string): Card => ({
  kind: 'trainer',
  id,
  name: id,
  mark: 'H',
  prints: [id],
  trainer: 'Item',
  tags: [],
  rules: [],
})

const deckOf = (...entries: [number, Card][]): DeckEntry[] =>
  entries.map(([count, card]) => ({ count, card }))
const ids = (...names: string[]): Group => new Set(names)

/** Every way to pick `k` of `items`. */
function* combinations<T>(items: T[], k: number, start = 0): Generator<T[]> {
  if (k === 0) {
    yield []
    return
  }
  for (let i = start; i <= items.length - k; i++) {
    for (const rest of combinations(items, k - 1, i + 1)) yield [items[i], ...rest]
  }
}

/**
 * Brute force: label every card, enumerate every (hand, prizes, drawn) split, and count.
 * Independent of the DP, so it checks the DP's counting and the mulligan conditioning.
 */
function bruteForce(
  deck: DeckEntry[],
  sizes: { hand: number; prizes: number; drawn: number },
  hit: (zones: { hand: Card[]; prizes: Card[]; drawn: Card[] }) => boolean,
  noMulligan: boolean,
): number {
  const cards = deck.flatMap((e) => Array.from({ length: e.count }, () => e.card))
  const all = cards.map((_, i) => i)
  let hits = 0
  let valid = 0
  for (const hand of combinations(all, sizes.hand)) {
    const handCards = hand.map((i) => cards[i])
    if (noMulligan && !handCards.some(isBasicPokemon)) continue
    const rest = all.filter((i) => !hand.includes(i))
    for (const prizes of combinations(rest, sizes.prizes)) {
      const left = rest.filter((i) => !prizes.includes(i))
      for (const drawn of combinations(left, sizes.drawn)) {
        valid++
        const zones = {
          hand: handCards,
          prizes: prizes.map((i) => cards[i]),
          drawn: drawn.map((i) => cards[i]),
        }
        if (hit(zones)) hits++
      }
    }
  }
  return hits / valid
}

const countIn = (cards: Card[], group: Group) => cards.filter((c) => group.has(c.id)).length

// 11 cards: 2 A (Basic), 1 B (Basic), 3 C (Stage 1), 5 D (Item). Hand 3, prizes 2.
const small = deckOf([2, basic('A')], [1, basic('B')], [3, stage1('C')], [5, item('D')])
const smallOptions = { handSize: 3, prizeCount: 2 }

describe('exact odds match brute force on a small deck', () => {
  const cases: { name: string; conditions: Condition[]; draws: number }[] = [
    { name: '≥1 A in hand', conditions: [{ group: ids('A'), atLeast: 1 }], draws: 0 },
    { name: '≥2 A by 2 draws', conditions: [{ group: ids('A'), atLeast: 2 }], draws: 2 },
    { name: '≥2 C by 3 draws', conditions: [{ group: ids('C'), atLeast: 2 }], draws: 3 },
    {
      name: 'A and C',
      conditions: [
        { group: ids('A'), atLeast: 1 },
        { group: ids('C'), atLeast: 1 },
      ],
      draws: 1,
    },
    {
      name: 'overlapping groups',
      conditions: [
        { group: ids('A', 'B'), atLeast: 2 },
        { group: ids('B', 'C'), atLeast: 2 },
      ],
      draws: 2,
    },
  ]
  for (const { name, conditions, draws } of cases) {
    for (const noMulligan of [false, true]) {
      it(`${name}${noMulligan ? ', no mulligan' : ''}`, () => {
        const expected = bruteForce(
          small,
          { hand: 3, prizes: 2, drawn: draws },
          (z) =>
            conditions.every(
              (c) => countIn(z.hand, c.group) + countIn(z.drawn, c.group) >= c.atLeast,
            ),
          noMulligan,
        )
        const { p } = chance(small, conditions, draws, { ...smallOptions, noMulligan })
        expect(p).toBeCloseTo(expected, 12)
      })
    }
  }

  for (const noMulligan of [false, true]) {
    it(`prize distribution${noMulligan ? ', no mulligan' : ''}`, () => {
      for (const group of [ids('A'), ids('C'), ids('A', 'B')]) {
        const dist = prizeDistribution(small, group, { ...smallOptions, noMulligan })
        dist.forEach((p, n) => {
          const expected = bruteForce(
            small,
            { hand: 3, prizes: 2, drawn: 0 },
            (z) => countIn(z.prizes, group) === n,
            noMulligan,
          )
          expect(p).toBeCloseTo(expected, 12)
        })
        expect(dist.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
      }
    })
  }

  it('mulligan chance', () => {
    const expected = bruteForce(
      small,
      { hand: 3, prizes: 0, drawn: 0 },
      (z) => !z.hand.some(isBasicPokemon),
      false,
    )
    expect(mulliganChance(small, smallOptions)).toBeCloseTo(expected, 12)
  })
})

// 60 cards: 10 Basics (4 X + 6 Y), 50 others.
const full = deckOf([4, basic('X')], [6, basic('Y')], [4, item('Z')], [46, item('W')])

describe('60-card decks', () => {
  it('the mulligan chance matches the hypergeometric formula', () => {
    const p = choose(50, 7) / choose(60, 7)
    expect(mulliganChance(full)).toBeCloseTo(p, 12)
  })

  it('without the mulligan rule, ≥1 of 4 in 7 is the textbook number', () => {
    const p = 1 - choose(56, 7) / choose(60, 7)
    expect(chance(full, [{ group: ids('Z'), atLeast: 1 }], 0, { noMulligan: false }).p).toBeCloseTo(
      p,
      12,
    )
  })

  it('prizes do not change the odds of drawing a card', () => {
    // Without conditioning, the first 7 + N draws are a random 7 + N cards of the deck.
    const p = 1 - choose(56, 9) / choose(60, 9)
    expect(chance(full, [{ group: ids('Z'), atLeast: 1 }], 2, { noMulligan: false }).p).toBeCloseTo(
      p,
      12,
    )
  })

  it('without the mulligan rule, prizes are a random 6 of 60', () => {
    const dist = prizeDistribution(full, ids('Z'), { noMulligan: false })
    dist.forEach((p, n) => {
      expect(p).toBeCloseTo((choose(4, n) * choose(56, 6 - n)) / choose(60, 6), 12)
    })
  })

  it('a valid opener makes Basics likelier in hand and a non-Basic slightly less likely', () => {
    const x = [{ group: ids('X'), atLeast: 1 }]
    const z = [{ group: ids('Z'), atLeast: 1 }]
    expect(chance(full, x, 0).p).toBeGreaterThan(chance(full, x, 0, { noMulligan: false }).p)
    expect(chance(full, z, 0).p).toBeLessThan(chance(full, z, 0, { noMulligan: false }).p)
  })

  it('a deck with no Basics always mulligans', () => {
    const none = deckOf([60, item('W')])
    expect(mulliganChance(none)).toBe(1)
    expect(chance(none, [{ group: ids('W'), atLeast: 1 }], 0).p).toBeNaN()
  })
})

describe('Monte Carlo agrees on a 60-card deck', () => {
  it('opening hand + prizes + draws with the mulligan rule', () => {
    // Seeded PRNG (mulberry32) so the test is deterministic.
    let seed = 12345
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const cards = full.flatMap((e) => Array.from({ length: e.count }, () => e.card.id))
    const shuffle = () => {
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[cards[i], cards[j]] = [cards[j], cards[i]]
      }
    }
    const trials = 100_000
    let hits = 0
    for (let t = 0; t < trials; t++) {
      do shuffle()
      while (!cards.slice(0, 7).some((id) => id === 'X' || id === 'Y'))
      // Hand 0–6, prizes 7–12, draws 13–14 (by your turn 2).
      const seen = [...cards.slice(0, 7), ...cards.slice(13, 15)]
      if (seen.filter((id) => id === 'X').length >= 2) hits++
    }
    const exact = chance(full, [{ group: ids('X'), atLeast: 2 }], drawsBy(2)).p
    // ~4 standard errors at p ≈ 0.2.
    expect(Math.abs(hits / trials - exact)).toBeLessThan(0.005)
  })
})

describe('drawsBy', () => {
  it('both players draw on their first turn', () => {
    expect(drawsBy(1)).toBe(1)
    expect(drawsBy(3)).toBe(3)
  })
})

describe('onlyBasicChance', () => {
  // Every Basic in the opening hand is from the group, and there is at least one.
  const onlyFrom = (group: Group) => (z: { hand: Card[] }) => {
    const basics = z.hand.filter(isBasicPokemon)
    return basics.length > 0 && basics.every((c) => group.has(c.id))
  }
  for (const noMulligan of [false, true]) {
    for (const name of ['A', 'B']) {
      it(`${name} is the only Basic${noMulligan ? ', no mulligan' : ''}`, () => {
        const expected = bruteForce(
          small,
          { hand: 3, prizes: 2, drawn: 0 },
          onlyFrom(ids(name)),
          noMulligan,
        )
        const got = onlyBasicChance(small, ids(name), { ...smallOptions, noMulligan })
        expect(got).toBeCloseTo(expected, 12)
      })
    }
  }

  it('is 1 when the deck has a single Basic card (no mulligan)', () => {
    const deck = deckOf([4, basic('A')], [7, item('D')])
    expect(onlyBasicChance(deck, ids('A'), { ...smallOptions, noMulligan: true })).toBeCloseTo(
      1,
      12,
    )
  })
})
