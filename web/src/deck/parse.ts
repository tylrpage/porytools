import type { CardDb } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'

/** One card and how many copies. Every print of a card is the same card here. */
export interface DeckEntry {
  count: number
  card: Card
}

/**
 * One line of the list as written, keeping the print it named (e.g. "PAL-172" for Boss's
 * Orders). Share links and exports use these, so they give back the user's own list;
 * the site and solver use the merged `entries`.
 */
export interface DeckLine extends DeckEntry {
  printId: string
}

export interface Problem {
  severity: 'error' | 'warning'
  message: string
  /** 1-based line in the pasted text, when the problem comes from one line. */
  line?: number
}

export interface ParseResult {
  /** Merged by card: two prints of Ultra Ball are one entry. */
  entries: DeckEntry[]
  /** As written. */
  lines: DeckLine[]
  problems: Problem[]
}

/** Section headers and totals in PTCG Live and Limitless exports, e.g. "Pokémon: 12". */
const HEADER = /^(#+\s*)?(pok[eé]mon|trainers?|energy|total cards)\b.*$/i
/** "4 Dreepy TWM 128", "4x Dreepy TWM 128", or "4 Ultra Ball". Codes can start with a digit ("30C"). */
const CARD_LINE = /^(\d+)x?\s+(.+)$/i
/** Trailing set code and number: "TWM 128", "PR-SV 12", "MEG 5", "SVP 007". */
const CODE_NUMBER = /^(.+?)\s+([A-Za-z0-9][A-Za-z0-9-]{1,7})\s+([A-Za-z]*\d+[A-Za-z]?)$/
/** A trailing set code with no number, as Limitless writes basic Energy: "Psychic Energy MEE". */
const CODE_ONLY = /^(.+?)\s+([A-Z][A-Z0-9-]{1,7})$/

/**
 * Parse a decklist in PTCG Live export or Limitless text format. Unknown lines and cards
 * become problems instead of exceptions, so the user sees everything wrong at once.
 */
export function parseDecklist(text: string, db: CardDb): ParseResult {
  const lines: DeckLine[] = []
  const problems: Problem[] = []

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1
    const trimmed = raw.trim()
    if (trimmed === '' || HEADER.test(trimmed)) return

    const m = CARD_LINE.exec(trimmed)
    if (!m) {
      problems.push({ severity: 'error', line, message: `Couldn't read "${trimmed}"` })
      return
    }
    const count = Number(m[1])
    if (count < 1) {
      problems.push({ severity: 'error', line, message: `Count must be at least 1: "${trimmed}"` })
      return
    }
    const resolved = resolveCard(m[2], db)
    if ('error' in resolved) {
      problems.push({ severity: 'error', line, message: resolved.error })
      return
    }
    if (resolved.warning) problems.push({ severity: 'warning', line, message: resolved.warning })
    lines.push({ count, card: resolved.card, printId: resolved.printId ?? resolved.card.id })
  })

  return { entries: mergeByCard(lines), lines, problems }
}

/** One entry per card, in order of first appearance. */
export function mergeByCard(lines: DeckEntry[]): DeckEntry[] {
  const entries: DeckEntry[] = []
  for (const { card, count } of lines) {
    const existing = entries.find((e) => e.card === card)
    if (existing) existing.count += count
    else entries.push({ count, card })
  }
  return entries
}

/** `printId` is set when the line named a print that exists. */
type Resolved = { card: Card; printId?: string; warning?: string } | { error: string }

const isBasicEnergy = (card: Card) => card.kind === 'energy' && card.basic

function resolveCard(rest: string, db: CardDb): Resolved {
  const withCode = CODE_NUMBER.exec(rest)
  if (withCode) {
    const [, name, code, number] = withCode
    const printId = db.printByCode(code, number)
    const card = printId && db.cardOfPrint(printId)
    if (card) {
      // Trust the set code and number, but flag a name that clearly doesn't match.
      const named = db.cardsByName(name)
      const warning =
        named.length > 0 && !named.includes(card)
          ? `${code} ${number} is ${card.name}, not ${name}; using ${card.name}`
          : undefined
      return { card, printId, warning }
    }
    // Unknown set code or number: fall back to the name.
    const byName = resolveByName(name, db)
    if ('error' in byName) {
      return { error: `${name} ${code} ${number} isn't a known Standard-legal card` }
    }
    // Basic Energy prints are interchangeable, so an odd code there isn't worth a warning.
    return isBasicEnergy(byName.card)
      ? byName
      : { ...byName, warning: `Didn't recognize ${code} ${number}; matched "${name}" by name` }
  }

  const byName = resolveByName(rest, db)
  if (!('error' in byName)) return byName
  const codeOnly = CODE_ONLY.exec(rest)
  if (codeOnly) {
    const energy = resolveByName(codeOnly[1], db)
    if (!('error' in energy) && isBasicEnergy(energy.card)) return energy
  }
  return byName
}

function resolveByName(name: string, db: CardDb): Resolved {
  const cards = db.cardsByName(name)
  if (cards.length === 0) return { error: `${name} isn't a known Standard-legal card` }
  if (cards.length > 1) {
    const options = cards.map((c) => db.printLabel(c.id)).join(', ')
    return {
      error: `There are ${cards.length} different cards named ${name}; add a set code and number (${options})`,
    }
  }
  return { card: cards[0] }
}
