// Exact odds for one shuffled deal: the opening hand, the prizes, and the next draws.
//
// The deck is split into piles of identical-for-this-question cards (for example "Dreepy",
// "other Basics", "everything else"). A deal takes some cards from each pile into each
// zone. Counting the ways to do that, pile by pile, gives every probability on the odds page
// with no sampling. The method is exact; the arithmetic is floating point (full-deal counts
// reach ~1e23, past the 2^53 where integers stay exact), so results carry a relative
// rounding error around 1e-15, far below the 0.1% the page shows.
//
// Why one joint deal works even though prizes are set aside after the hand and draws come
// later: a shuffled deck is in uniformly random order, so "7 cards, then 6, then N" are just
// three disjoint random slices of it. Any rule that looks only at what ended up in each zone
// (like "the hand has a Basic") can be applied afterwards as a condition.

export type Zone = 'hand' | 'prizes' | 'drawn'

export const ZONES: readonly Zone[] = ['hand', 'prizes', 'drawn']

/** How many cards go to each zone. */
export type DealSizes = Record<Zone, number>

/** Cards the question treats as identical. `groups` is a bitmask: bit i set = in group i. */
export interface Pile {
  count: number
  groups: number
}

/** Counts cards of one group across some zones, stopping at `cap` (we only need "≥ cap"). */
export interface Tracker {
  group: number
  zones: readonly Zone[]
  cap: number
}

export interface Outcome {
  /** One value per tracker, each at most its cap. */
  readonly counts: readonly number[]
  readonly p: number
}

const pascal: number[][] = []

/** C(n, k) from a cached Pascal's triangle. Exact below 2^53, which covers every C(60, k ≤ 13) a deal uses. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n || n < 0) return 0
  for (let row = pascal.length; row <= n; row++) {
    const prev = pascal[row - 1]
    pascal.push(
      Array.from({ length: row + 1 }, (_, j) => (j === 0 || j === row ? 1 : prev[j - 1] + prev[j])),
    )
  }
  return pascal[n][k]
}

/**
 * Probability of every combination of tracker counts after one deal.
 *
 * Dynamic programming over piles: the state is (cards placed in each zone so far, each
 * tracker's capped count). For each pile we try every split of its cards into hand /
 * prizes / drawn / left in deck, weighted by the number of ways to pick those cards.
 * States stay tiny (zone sizes ≤ 7 and caps ≤ 4), so this is instant for real decks.
 */
export function deal(
  piles: readonly Pile[],
  sizes: DealSizes,
  trackers: readonly Tracker[],
): readonly Outcome[] {
  const key = cacheKey(canonicalPiles(piles), sizes, trackers)
  const hit = cache.get(key)
  if (hit) return hit
  const outcomes = computeDeal(piles, sizes, trackers)
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
  cache.set(key, outcomes)
  return outcomes
}

/**
 * Results of recent deals. The odds page asks many questions with the same shape (every
 * 4-copy card's row is the same deal), and re-renders (typing a group name) repeat them all,
 * so most calls are lookups. Cached results are shared: treat them as read-only.
 */
const cache = new Map<string, readonly Outcome[]>()
const CACHE_LIMIT = 2000

/** For tests. */
export const dealCache = {
  clear: () => cache.clear(),
  get size() {
    return cache.size
  },
}

/** Everything a deal's result depends on. Piles must be canonical (merged and sorted). */
function cacheKey(piles: readonly Pile[], sizes: DealSizes, trackers: readonly Tracker[]) {
  return [
    ZONES.map((z) => sizes[z]).join(','),
    trackers.map((t) => `${t.group}:${t.zones.join('+')}:${t.cap}`).join(','),
    piles.map((p) => `${p.count}:${p.groups}`).join(','),
  ].join('|')
}

/** `deal` without the cache. Exported for tests. */
export function computeDeal(
  piles: readonly Pile[],
  sizes: DealSizes,
  trackers: readonly Tracker[],
): readonly Outcome[] {
  const total = piles.reduce((n, p) => n + p.count, 0)
  const needed = sizes.hand + sizes.prizes + sizes.drawn
  if (total < needed) throw new Error(`The deck has ${total} cards; the deal needs ${needed}`)

  // Mixed-radix state key: [hand, prizes, drawn, tracker 0, tracker 1, …].
  const radix = [
    sizes.hand + 1,
    sizes.prizes + 1,
    sizes.drawn + 1,
    ...trackers.map((t) => t.cap + 1),
  ]
  const encode = (digits: number[]) => digits.reduce((key, d, i) => key * radix[i] + d, 0)
  const decode = (key: number) => {
    const digits = new Array<number>(radix.length)
    for (let i = radix.length - 1; i >= 0; i--) {
      digits[i] = key % radix[i]
      key = Math.floor(key / radix[i])
    }
    return digits
  }

  // The last pile has no choice left: it fills whatever each zone still needs. Putting the
  // biggest pile (usually "every other card") last skips its large loops entirely.
  const ordered = canonicalPiles(piles)
  let states = new Map<number, number>([[encode(radix.map(() => 0)), 1]])
  ordered.forEach((pile, index) => {
    const last = index === ordered.length - 1
    const n = pile.count
    const inGroup = trackers.map((t) => (pile.groups >> t.group) & 1)
    const next = new Map<number, number>()
    const add = (
      h0: number,
      p0: number,
      d0: number,
      t0: number[],
      ways: number,
      h: number,
      p: number,
      d: number,
    ) => {
      const w = choose(n, h) * choose(n - h, p) * choose(n - h - p, d)
      if (w === 0) return
      const digits = [h0 + h, p0 + p, d0 + d]
      for (let i = 0; i < trackers.length; i++) {
        const t = trackers[i]
        let c = t0[i]
        if (inGroup[i]) {
          for (const z of t.zones) c += z === 'hand' ? h : z === 'prizes' ? p : d
        }
        digits.push(Math.min(t.cap, c))
      }
      const k = encode(digits)
      next.set(k, (next.get(k) ?? 0) + ways * w)
    }
    for (const [key, ways] of states) {
      const [h0, p0, d0, ...t0] = decode(key)
      if (last) {
        add(h0, p0, d0, t0, ways, sizes.hand - h0, sizes.prizes - p0, sizes.drawn - d0)
        continue
      }
      for (let h = 0; h <= Math.min(n, sizes.hand - h0); h++) {
        for (let p = 0; p <= Math.min(n - h, sizes.prizes - p0); p++) {
          for (let d = 0; d <= Math.min(n - h - p, sizes.drawn - d0); d++) {
            add(h0, p0, d0, t0, ways, h, p, d)
          }
        }
      }
    }
    states = next
  })

  // Keep only complete deals and turn ways into probabilities.
  const complete: { counts: number[]; ways: number }[] = []
  let sum = 0
  for (const [key, ways] of states) {
    const [h, p, d, ...counts] = decode(key)
    if (h !== sizes.hand || p !== sizes.prizes || d !== sizes.drawn) continue
    complete.push({ counts, ways })
    sum += ways
  }
  return complete.map((o) => ({ counts: o.counts, p: o.ways / sum }))
}

/**
 * Piles merged and in a fixed order: smallest first (see `computeDeal`), ties by groups.
 * Decks that differ only in pile order or splitting give the same list, so they share a
 * cache entry.
 */
function canonicalPiles(piles: readonly Pile[]): Pile[] {
  return mergePiles(piles).sort((x, y) => x.count - y.count || x.groups - y.groups)
}

/** Piles in the same groups are interchangeable; merging them keeps the state space small. */
function mergePiles(piles: readonly Pile[]): Pile[] {
  const byGroups = new Map<number, number>()
  for (const p of piles) {
    if (p.count > 0) byGroups.set(p.groups, (byGroups.get(p.groups) ?? 0) + p.count)
  }
  return [...byGroups].map(([groups, count]) => ({ groups, count }))
}
