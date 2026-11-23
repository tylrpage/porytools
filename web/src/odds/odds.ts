// The odds-page questions, in game terms, on top of the exact deal in deal.ts.

import type { Card } from '../cards/types.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { type DealSizes, deal, type Outcome, type Pile, type Tracker, type Zone } from './deal.ts'

export const HAND_SIZE = 7
export const PRIZE_COUNT = 6

export const isBasicPokemon = (card: Card) => card.kind === 'pokemon' && card.stage === 'Basic'

/** A set of cards counted together, e.g. one card, "any Basic Pokémon", or a custom pick. */
export type Group = ReadonlySet<string>

/** "At least `atLeast` cards of `group`." */
export interface Condition {
  group: Group
  atLeast: number
}

export interface OddsOptions {
  /**
   * Count only opening hands with a Basic Pokémon, like the real game: a hand without one
   * is shown, reshuffled and redrawn until it has one. On by default. Off gives the plain
   * "first 7 cards" odds.
   */
  noMulligan?: boolean
  /** For tests on small decks. */
  handSize?: number
  prizeCount?: number
}

/** Draws at the start of your turns up to and including turn `turn`. Going first skips turn 1's. */
export function drawsBy(turn: number, goingFirst: boolean): number {
  return goingFirst ? turn - 1 : turn
}

/** P(the opening 7 has no Basic Pokémon). */
export function mulliganChance(deck: readonly DeckEntry[], options: OddsOptions = {}): number {
  return chance(deck, [{ group: basicIds(deck), atLeast: 1 }], 0, {
    ...options,
    noMulligan: false,
  }).complement
}

/**
 * Expected number of mulligans before a hand with a Basic: redraws are independent, so it's
 * geometric with mean p / (1 − p).
 */
export function expectedMulligans(deck: readonly DeckEntry[], options: OddsOptions = {}): number {
  const p = mulliganChance(deck, options)
  return p >= 1 ? Infinity : p / (1 - p)
}

/**
 * P(every condition holds) counting the opening hand plus the next `draws` cards. Prizes are
 * dealt in between, so a prized card can't be drawn. `draws = 0` is the opening hand.
 * Card effects that draw or search are not modeled here; that's the solver's job.
 */
export function chance(
  deck: readonly DeckEntry[],
  conditions: readonly Condition[],
  draws: number,
  options: OddsOptions = {},
): { p: number; complement: number } {
  const trackers = conditions.map((c, i) => ({
    group: i,
    zones: ['hand', 'drawn'] as Zone[],
    cap: c.atLeast,
  }))
  const outcomes = conditionedDeal(
    deck,
    conditions.map((c) => c.group),
    trackers,
    draws,
    options,
  )
  let p = outcomes.length === 0 ? NaN : 0
  for (const o of outcomes) {
    if (conditions.every((c, i) => o.counts[i] >= c.atLeast)) p += o.p
  }
  return { p, complement: 1 - p }
}

/** P(exactly n cards of `group` are prized), for n = 0 … min(copies, prizes). */
export function prizeDistribution(
  deck: readonly DeckEntry[],
  group: Group,
  options: OddsOptions = {},
): number[] {
  const copies = deck.reduce((n, e) => n + (group.has(e.card.id) ? e.count : 0), 0)
  const max = Math.min(copies, options.prizeCount ?? PRIZE_COUNT)
  const dist = new Array<number>(max + 1).fill(0)
  const outcomes = conditionedDeal(
    deck,
    [group],
    [{ group: 0, zones: ['prizes'], cap: max }],
    0,
    options,
  )
  for (const o of outcomes) dist[o.counts[0]] += o.p
  return outcomes.length === 0 ? dist.fill(NaN) : dist
}

/**
 * The deal's outcomes for these groups and trackers, given the mulligan rule: with
 * `noMulligan`, hands without a Basic are dropped and the rest rescaled to sum to 1.
 * Empty when no hand is valid (a deck with no Basics).
 */
function conditionedDeal(
  deck: readonly DeckEntry[],
  groups: readonly Group[],
  trackers: readonly Tracker[],
  draws: number,
  options: OddsOptions,
): Outcome[] {
  const noMulligan = options.noMulligan ?? true
  // The deal's last group is Basic Pokémon, for the mulligan rule.
  const all = [...groups, basicIds(deck)]
  const piles: Pile[] = deck.map((e) => ({
    count: e.count,
    groups: all.reduce((mask, g, i) => (g.has(e.card.id) ? mask | (1 << i) : mask), 0),
  }))
  const withBasic = noMulligan
    ? [...trackers, { group: groups.length, zones: ['hand'] as Zone[], cap: 1 }]
    : trackers
  const sizes: DealSizes = {
    hand: options.handSize ?? HAND_SIZE,
    prizes: options.prizeCount ?? PRIZE_COUNT,
    drawn: draws,
  }
  let outcomes = deal(piles, sizes, withBasic)
  if (noMulligan) {
    outcomes = outcomes.filter((o) => o.counts[trackers.length] === 1)
    const valid = outcomes.reduce((n, o) => n + o.p, 0)
    outcomes = outcomes.map((o) => ({ counts: o.counts.slice(0, trackers.length), p: o.p / valid }))
  }
  return outcomes.filter((o) => o.p > 0)
}

function basicIds(deck: readonly DeckEntry[]): Group {
  return new Set(deck.filter((e) => isBasicPokemon(e.card)).map((e) => e.card.id))
}
