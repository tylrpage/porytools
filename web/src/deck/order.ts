import { type CardDb, nameKey } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import type { DeckEntry } from './parse.ts'
import { sectionOf } from './share.ts'

// The order every card listing on the site uses (odds table, dropdowns, group checkboxes,
// deck view): Pokémon, then Trainers, then Energy.
// - Trainers and Energy: most copies first, then by name.
// - Pokémon: whole evolution lines stay together, most basic stage first. Lines are ordered
//   by their total copies, then by name.

const SECTION_RANK = { Pokémon: 0, Trainer: 1, Energy: 2 } as const
const STAGE_RANK = { Basic: 0, 'Stage 1': 1, 'Stage 2': 2 } as const

/** Most copies first, then by name, then by ID so different prints of a name keep one order. */
function byCountThenName(a: DeckEntry, b: DeckEntry): number {
  return (
    b.count - a.count ||
    a.card.name.localeCompare(b.card.name) ||
    a.card.id.localeCompare(b.card.id)
  )
}

/**
 * The deck in display order. `db` lets an evolution line stay together when a middle stage
 * isn't in the deck (e.g. Dreepy and Dragapult ex with no Drakloak, played with Rare Candy).
 * Returns a new array; the entries themselves are shared.
 */
export function sortEntries<T extends DeckEntry>(entries: readonly T[], db?: CardDb): T[] {
  const lines = evolutionLines(entries, db)
  const lineTotal = new Map<string, number>()
  for (const e of entries) {
    const line = lines.get(e.card)
    if (line !== undefined) lineTotal.set(line, (lineTotal.get(line) ?? 0) + e.count)
  }
  // Lines with equal totals go by the name of their most basic card in the deck.
  const lineName = new Map<string, string>()
  for (const e of [...entries].sort(byStageThenCount)) {
    const line = lines.get(e.card)
    if (line !== undefined && !lineName.has(line)) lineName.set(line, e.card.name)
  }

  return [...entries].sort((a, b) => {
    const section = SECTION_RANK[sectionOf(a.card)] - SECTION_RANK[sectionOf(b.card)]
    if (section !== 0) return section
    const la = lines.get(a.card)
    const lb = lines.get(b.card)
    if (la === undefined || lb === undefined) return byCountThenName(a, b)
    if (la !== lb) {
      return (
        lineTotal.get(lb)! - lineTotal.get(la)! ||
        lineName.get(la)!.localeCompare(lineName.get(lb)!) ||
        la.localeCompare(lb)
      )
    }
    return byStageThenCount(a, b)
  })
}

function byStageThenCount(a: DeckEntry, b: DeckEntry): number {
  return stageRank(a.card) - stageRank(b.card) || byCountThenName(a, b)
}

function stageRank(card: Card): number {
  return card.kind === 'pokemon' ? STAGE_RANK[card.stage] : 0
}

/**
 * Each Pokémon card's evolution line, named by the (name key of the) earliest stage found
 * by following "evolves from" back. Branching lines (Eevee and its evolutions) share one.
 */
function evolutionLines(entries: readonly DeckEntry[], db?: CardDb): Map<Card, string> {
  // "Evolves from" by name, from the deck first, then the card data for missing stages.
  const parentOf = new Map<string, string | undefined>()
  for (const { card } of entries) {
    if (card.kind === 'pokemon') {
      parentOf.set(nameKey(card.name), card.evolvesFrom && nameKey(card.evolvesFrom))
    }
  }
  const parent = (key: string): string | undefined => {
    if (!parentOf.has(key)) {
      const card = db?.cardsByName(key).find((c) => c.kind === 'pokemon')
      parentOf.set(
        key,
        card?.kind === 'pokemon' && card.evolvesFrom ? nameKey(card.evolvesFrom) : undefined,
      )
    }
    return parentOf.get(key)
  }

  const lines = new Map<Card, string>()
  for (const { card } of entries) {
    if (card.kind !== 'pokemon') continue
    let key = nameKey(card.name)
    const seen = new Set([key])
    for (let up = parent(key); up !== undefined && !seen.has(up); up = parent(up)) {
      key = up
      seen.add(up)
    }
    lines.set(card, key)
  }
  return lines
}
