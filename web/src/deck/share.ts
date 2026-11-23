import { type CardDb, ENERGY_SYMBOLS } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import { addToDeck, type DeckEntry, type ParseResult } from './parse.ts'

// Share links carry the deck in the URL: `?d=1.4me1-131.3sv6-128…`
// The first field is the format version, then one "<count><card ID>" per entry. IDs start
// with a letter, so the count is the leading digits. Every character used is URL-safe, so
// links stay readable and need no compression at ~20 entries. Decoding accepts any print
// ID, so old links keep working when a card's display print changes.

const VERSION = '1'

export function encodeDeck(entries: DeckEntry[]): string {
  return [VERSION, ...entries.map((e) => `${e.count}${e.card.id}`)].join('.')
}

export function decodeDeck(encoded: string, db: CardDb): ParseResult {
  const result: ParseResult = { entries: [], problems: [] }
  const [version, ...fields] = encoded.split('.')
  if (version !== VERSION) {
    result.problems.push({
      severity: 'error',
      message: `Unsupported share link (version ${version})`,
    })
    return result
  }
  for (const field of fields) {
    const m = /^(\d+)([a-z].*)$/i.exec(field)
    const card = m && db.cardOfPrint(m[2])
    if (!m || !card || Number(m[1]) < 1) {
      result.problems.push({ severity: 'error', message: `Unknown card in share link: "${field}"` })
      continue
    }
    addToDeck(result.entries, card, Number(m[1]))
  }
  return result
}

export type Section = 'Pokémon' | 'Trainer' | 'Energy'

export function sectionOf(card: Card): Section {
  return card.kind === 'pokemon' ? 'Pokémon' : card.kind === 'trainer' ? 'Trainer' : 'Energy'
}

/** Entries grouped into the three decklist sections, in that order. */
export function groupBySection(entries: DeckEntry[]): [Section, DeckEntry[]][] {
  const sections: Section[] = ['Pokémon', 'Trainer', 'Energy']
  return sections.map((s) => [s, entries.filter((e) => sectionOf(e.card) === s)])
}

/** PTCG Live export format, which Limitless also reads. */
export function formatDecklist(entries: DeckEntry[], db: CardDb): string {
  const lines: string[] = []
  for (const [section, list] of groupBySection(entries)) {
    if (list.length === 0) continue
    const count = list.reduce((n, e) => n + e.count, 0)
    lines.push(`${section}: ${count}`)
    for (const e of list) lines.push(`${e.count} ${exportName(e.card)} ${db.printLabel(e.card.id)}`)
    lines.push('')
  }
  lines.push(`Total Cards: ${entries.reduce((n, e) => n + e.count, 0)}`)
  return lines.join('\n')
}

/** PTCG Live writes basic Energy with its symbol: "Basic {P} Energy". */
function exportName(card: Card): string {
  if (card.kind !== 'energy' || !card.basic) return card.name
  const symbol = Object.keys(ENERGY_SYMBOLS).find((s) => ENERGY_SYMBOLS[s] === card.provides)
  return `Basic {${symbol}} Energy`
}
