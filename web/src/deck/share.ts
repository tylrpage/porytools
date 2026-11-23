import { type CardDb, ENERGY_SYMBOLS } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import { type DeckEntry, type DeckLine, mergeByCard, type ParseResult } from './parse.ts'

// Share links carry the deck in the URL: `?d=2.4_TWM-128.2_PAL-172…`
// The first field is the format version, then one "<count>_<print ID>" per decklist line,
// with the prints the user listed (not the display prints), so a shared list comes back
// as written. Every character used is URL-safe, so links stay readable and need no
// compression at ~20 lines.

const VERSION = '2'

export function encodeDeck(lines: DeckLine[]): string {
  return [VERSION, ...lines.map((l) => `${l.count}_${l.printId}`)].join('.')
}

export function decodeDeck(encoded: string, db: CardDb): ParseResult {
  const result: ParseResult = { entries: [], lines: [], problems: [] }
  const [version, ...fields] = encoded.split('.')
  if (version !== VERSION) {
    result.problems.push({
      severity: 'error',
      message: `Unsupported share link (version ${version})`,
    })
    return result
  }
  for (const field of fields) {
    const m = /^(\d+)_(.+)$/.exec(field)
    const card = m && db.cardOfPrint(m[2])
    if (!m || !card || Number(m[1]) < 1) {
      result.problems.push({ severity: 'error', message: `Unknown card in share link: "${field}"` })
      continue
    }
    result.lines.push({ count: Number(m[1]), card, printId: m[2] })
  }
  result.entries = mergeByCard(result.lines)
  return result
}

export type Section = 'Pokémon' | 'Trainer' | 'Energy'

export function sectionOf(card: Card): Section {
  return card.kind === 'pokemon' ? 'Pokémon' : card.kind === 'trainer' ? 'Trainer' : 'Energy'
}

/** Entries grouped into the three decklist sections, in that order. */
export function groupBySection<T extends DeckEntry>(entries: T[]): [Section, T[]][] {
  const sections: Section[] = ['Pokémon', 'Trainer', 'Energy']
  return sections.map((s) => [s, entries.filter((e) => sectionOf(e.card) === s)])
}

/** PTCG Live export format, which Limitless also reads, with the prints as listed. */
export function formatDecklist(entries: DeckLine[], db: CardDb): string {
  const lines: string[] = []
  for (const [section, list] of groupBySection(entries)) {
    if (list.length === 0) continue
    const count = list.reduce((n, e) => n + e.count, 0)
    lines.push(`${section}: ${count}`)
    for (const e of list) lines.push(`${e.count} ${exportName(e.card)} ${db.printLabel(e.printId)}`)
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
