import type { Card } from '../cards/types.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { isBasicPokemon } from './odds.ts'

/** A named set of cards in one deck, counted together. */
export interface NamedGroup {
  key: string
  name: string
  ids: ReadonlySet<string>
}

interface BuiltIn {
  key: string
  name: string
  test: (card: Card) => boolean
}

export const BUILT_IN_GROUPS: readonly BuiltIn[] = [
  { key: 'basic', name: 'Basic Pokémon', test: isBasicPokemon },
  { key: 'pokemon', name: 'Pokémon', test: (c) => c.kind === 'pokemon' },
  {
    key: 'supporter',
    name: 'Supporters',
    test: (c) => c.kind === 'trainer' && c.trainer === 'Supporter',
  },
  { key: 'item', name: 'Items', test: (c) => c.kind === 'trainer' && c.trainer === 'Item' },
  { key: 'energy', name: 'Energy', test: (c) => c.kind === 'energy' },
  { key: 'basic-energy', name: 'Basic Energy', test: (c) => c.kind === 'energy' && c.basic },
]

/** The built-in groups that have at least one card in this deck. */
export function builtInGroups(deck: readonly DeckEntry[]): NamedGroup[] {
  return BUILT_IN_GROUPS.map((g) => ({
    key: g.key,
    name: g.name,
    ids: new Set(deck.filter((e) => g.test(e.card)).map((e) => e.card.id)),
  })).filter((g) => g.ids.size > 0)
}

/** How many cards of the deck are in the group. */
export function copiesIn(deck: readonly DeckEntry[], ids: ReadonlySet<string>): number {
  return deck.reduce((n, e) => n + (ids.has(e.card.id) ? e.count : 0), 0)
}
