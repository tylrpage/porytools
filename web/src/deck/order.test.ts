import { describe, expect, it } from 'vitest'
import { fixtureDb } from '../cards/fixture.ts'
import { sortEntries } from './order.ts'

const db = fixtureDb()

/** Entries from "count id" pairs, in the order given. */
const deck = (...items: [number, string][]) =>
  items.map(([count, id]) => ({ count, card: db.card(id)! }))

const names = (entries: { card: { id: string; name: string } }[]) =>
  entries.map((e) => `${e.card.name} ${e.card.id}`)

describe('sortEntries', () => {
  it('puts sections in order, Trainers and Energy by count then name', () => {
    const sorted = sortEntries(
      deck(
        [10, 'SVE-13'],
        [2, 'TEF-157'],
        [4, 'MEG-114'],
        [4, 'MEG-131'],
        [1, 'TWM-167'],
        [12, 'SVE-2'],
        [2, 'MEG-50'],
      ),
    )
    expect(names(sorted)).toEqual([
      'Pikachu MEG-50',
      "Boss's Orders MEG-114",
      'Ultra Ball MEG-131',
      'Prime Catcher TEF-157',
      'Basic Fire Energy SVE-2',
      'Basic Psychic Energy SVE-13',
      'Legacy Energy TWM-167',
    ])
  })

  it('keeps evolution lines together, basic first, lines by total count', () => {
    const sorted = sortEntries(
      deck(
        [3, 'TWM-130'], // Dragapult ex
        [2, 'SSP-57'], // Pikachu ex
        [2, 'TWM-129'], // Drakloak
        [4, 'TWM-128'], // Dreepy
        [3, 'MEG-50'], // Pikachu
      ),
    )
    expect(names(sorted)).toEqual([
      'Dreepy TWM-128',
      'Drakloak TWM-129',
      'Dragapult ex TWM-130',
      'Pikachu MEG-50',
      'Pikachu ex SSP-57',
    ])
  })

  it('a big single Basic can come before a smaller line', () => {
    const sorted = sortEntries(deck([1, 'TWM-128'], [1, 'TWM-129'], [3, 'SSP-57']))
    expect(names(sorted)).toEqual(['Pikachu ex SSP-57', 'Dreepy TWM-128', 'Drakloak TWM-129'])
  })

  it('bridges a missing middle stage through the card data', () => {
    const entries = deck([1, 'TWM-130'], [1, 'TWM-128'], [1, 'MEG-50'])
    // Without the card data, Dragapult ex has no line to join and sorts on its own.
    expect(names(sortEntries(entries))).toEqual([
      'Dragapult ex TWM-130',
      'Dreepy TWM-128',
      'Pikachu MEG-50',
    ])
    expect(names(sortEntries(entries, db))).toEqual([
      'Dreepy TWM-128',
      'Dragapult ex TWM-130',
      'Pikachu MEG-50',
    ])
  })

  it('same-name prints sit together in a stable order', () => {
    const sorted = sortEntries(deck([2, 'PFL-60'], [2, 'MEG-50']))
    expect(names(sorted)).toEqual(['Pikachu MEG-50', 'Pikachu PFL-60'])
  })
})
