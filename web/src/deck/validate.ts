import type { CardDb } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import type { DeckEntry, Problem } from './parse.ts'

export const DECK_SIZE = 60
export const MAX_COPIES = 4

function isBasicEnergy(card: Card): boolean {
  return card.kind === 'energy' && card.basic
}

/**
 * Standard deck-building rules: exactly 60 cards, at most 4 copies of any card by name
 * (basic Energy excepted), at most 1 ACE SPEC, at least 1 Basic Pokémon, every card legal.
 */
export function validateDeck(
  entries: DeckEntry[],
  db: CardDb,
  oldestLegalMark = db.data.oldestLegalMark,
): Problem[] {
  const problems: Problem[] = []
  const error = (message: string) => problems.push({ severity: 'error', message })

  const total = entries.reduce((n, e) => n + e.count, 0)
  if (total !== DECK_SIZE) error(`The deck has ${total} cards; it needs exactly ${DECK_SIZE}`)

  // Copies count by name, across different prints and versions of a card.
  const byName = new Map<string, number>()
  for (const { card, count } of entries) {
    if (!isBasicEnergy(card)) byName.set(card.name, (byName.get(card.name) ?? 0) + count)
  }
  for (const [name, count] of byName) {
    if (count > MAX_COPIES) error(`${count} copies of ${name}; the limit is ${MAX_COPIES}`)
  }

  const aceSpecs = entries.filter((e) => e.card.aceSpec)
  const aceSpecCount = aceSpecs.reduce((n, e) => n + e.count, 0)
  if (aceSpecCount > 1) {
    const names = [...new Set(aceSpecs.map((e) => e.card.name))].join(', ')
    error(`${aceSpecCount} ACE SPEC cards (${names}); a deck may have only 1`)
  }

  if (!entries.some((e) => e.card.kind === 'pokemon' && e.card.stage === 'Basic')) {
    error('The deck has no Basic Pokémon')
  }

  const illegal = new Set(
    entries.filter((e) => !db.isLegal(e.card, oldestLegalMark)).map((e) => e.card),
  )
  for (const card of illegal) {
    error(
      `${card.name} isn't Standard-legal (needs regulation mark ${oldestLegalMark} or newer; its newest is ${card.mark})`,
    )
  }

  return problems
}
