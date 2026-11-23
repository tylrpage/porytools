import { printId, printLabel } from './ids.ts'
import { isStandardLegal } from './legality.ts'
import { CARD_DATA_VERSION, type Card, type CardData, type EnergyType } from './types.ts'

/** Lowercase, straight quotes, no accents, single spaces: for forgiving name matching. */
export function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Energy symbols as PTCG Live writes them, e.g. "Basic {R} Energy". */
export const ENERGY_SYMBOLS: Record<string, EnergyType> = {
  G: 'Grass',
  R: 'Fire',
  W: 'Water',
  L: 'Lightning',
  P: 'Psychic',
  F: 'Fighting',
  D: 'Darkness',
  M: 'Metal',
  N: 'Dragon',
  C: 'Colorless',
}

/**
 * The card database with the lookups the decklist parser needs. Built once from cards.json.
 */
export class CardDb {
  readonly data: CardData
  private readonly byId = new Map<string, Card>()
  /** Every print ID ("TWM-128") → its card. */
  private readonly byPrint = new Map<string, Card>()
  private readonly byName = new Map<string, Card[]>()

  constructor(data: CardData) {
    if (data.version !== CARD_DATA_VERSION) {
      throw new Error(`cards.json version ${data.version}, expected ${CARD_DATA_VERSION}`)
    }
    this.data = data
    for (const card of data.cards) {
      this.byId.set(card.id, card)
      const key = nameKey(card.name)
      this.byName.set(key, [...(this.byName.get(key) ?? []), card])
      for (const print of card.prints) this.byPrint.set(print, card)
    }
  }

  get cards(): readonly Card[] {
    return this.data.cards
  }

  card(id: string): Card | undefined {
    return this.byId.get(id)
  }

  /** The card a print ID (e.g. "TWM-128") belongs to. */
  cardOfPrint(printId: string): Card | undefined {
    return this.byPrint.get(printId)
  }

  /** The print ID a decklist set code and number name ("SVP", "007" → "PR-SV-7"), if known. */
  printByCode(code: string, number: string): string | undefined {
    const upper = code.toUpperCase()
    const id = printId(this.data.setCodeAliases[upper] ?? upper, number)
    return this.byPrint.has(id) ? id : undefined
  }

  /**
   * Cards with this name. Accepts PTCG Live basic Energy names like "Basic {R} Energy" and
   * Trainer names with the pictured character, like "Boss's Orders (Ghetsis)".
   */
  cardsByName(name: string): Card[] {
    const key = nameKey(basicEnergyName(name) ?? name)
    return this.byName.get(key) ?? this.byName.get(key.replace(/\s*\([^)]*\)$/, '')) ?? []
  }

  /** "TWM 128" for "TWM-128". */
  printLabel(id: string): string {
    return printLabel(id)
  }

  isLegal(card: Card, oldestLegalMark = this.data.oldestLegalMark): boolean {
    return isStandardLegal(card, oldestLegalMark)
  }
}

/**
 * Normalize the ways decklists write basic Energy ("Basic {R} Energy", "{R} Energy",
 * "Fire Energy", "Basic Fire Energy") to our name, "Basic Fire Energy". Null if the name
 * isn't a basic Energy.
 */
export function basicEnergyName(name: string): string | null {
  const m = /^(?:basic\s+)?(?:\{([a-z])\}|(\w+))\s+energy$/i.exec(name.trim())
  if (!m) return null
  const type = m[1]
    ? ENERGY_SYMBOLS[m[1].toUpperCase()]
    : m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()
  const basicTypes = [
    'Grass',
    'Fire',
    'Water',
    'Lightning',
    'Psychic',
    'Fighting',
    'Darkness',
    'Metal',
  ]
  return type && basicTypes.includes(type) ? `Basic ${type} Energy` : null
}

let loading: Promise<CardDb> | undefined

/** Fetch /data/cards.json once per page load. */
export function loadCardDb(): Promise<CardDb> {
  loading ??= fetch(`${import.meta.env.BASE_URL}data/cards.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Couldn't load card data (${res.status})`)
      return res.json() as Promise<CardData>
    })
    .then((data) => new CardDb(data))
  loading.catch(() => {
    loading = undefined // Let a later call retry.
  })
  return loading
}
