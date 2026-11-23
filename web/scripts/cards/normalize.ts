// Pure build logic for cards.json: apply overrides, normalize upstream cards into the
// compact format, collapse reprints, and filter to Standard. No I/O here, so it is easy to
// test; `build-cards.ts` does the fetching and writing.

import { normalizeNumber, printId, splitPrintId } from '../../src/cards/ids.ts'
import { compareMarks, markIsLegal } from '../../src/cards/legality.ts'
import {
  CARD_DATA_VERSION,
  type Ability,
  type Attack,
  type Card,
  type CardData,
  type EnergyType,
  type SetInfo,
  type Stage,
  type TrainerKind,
} from '../../src/cards/types.ts'

// ---- Source shapes (PokemonTCG/pokemon-tcg-data; tcgdex.ts converts to these too) ----

export interface RawSet {
  id: string
  name: string
  /** PTCG Live set code, e.g. "TWM". Sets without one are skipped. */
  ptcgoCode?: string
  /** "2024/05/24" */
  releaseDate: string
}

export interface RawCard {
  /**
   * The source's ID on input ("sv6-128"). The build replaces it with our print ID
   * ("TWM-128") before anything else reads it, so overrides use print IDs.
   */
  id: string
  name: string
  supertype: string
  subtypes?: string[]
  number: string
  regulationMark?: string
  rarity?: string
  hp?: string
  types?: string[]
  evolvesFrom?: string
  rules?: string[]
  abilities?: { name: string; text: string; type?: string }[]
  attacks?: { name: string; cost?: string[]; damage?: string; text?: string }[]
  weaknesses?: { type: string; value?: string }[]
  resistances?: { type: string; value?: string }[]
  convertedRetreatCost?: number
}

export interface Upstream {
  sets: RawSet[]
  /** Cards keyed by set ID. */
  cards: Record<string, RawCard[]>
}

/** data/config.json */
export interface Config {
  oldestLegalMark: string
  setCodeAliases: Record<string, string>
  /** Set IDs to leave out entirely, e.g. a subset that shares its parent's code. */
  excludeSets?: string[]
  /** TCGdex set IDs to add, for sets pokemon-tcg-data doesn't have. */
  tcgdexSets?: string[]
}

/** data/overrides.json */
export interface Overrides {
  /** Field-level fixes merged over a source card, keyed by print ID ("PBL-42"). */
  patches?: Record<string, Partial<RawCard>>
  /** Sets the sources haven't added yet. */
  sets?: RawSet[]
  /** Cards the sources haven't added yet, keyed by set ID. Same shape as upstream. */
  cards?: Record<string, RawCard[]>
}

export interface BuildResult {
  data: CardData
  /** Worth a look, but the output is still usable. */
  warnings: string[]
  /** The build must not ship with these. */
  errors: string[]
}

// ---- Overrides and IDs ----

export function applyOverrides(
  upstream: Upstream,
  overrides: Overrides,
  config: Config,
  warnings: string[],
  errors: string[],
): Upstream {
  const excluded = new Set(config.excludeSets ?? [])
  const sets = upstream.sets.filter((s) => !excluded.has(s.id))
  const cards: Record<string, RawCard[]> = {}
  for (const [setId, list] of Object.entries(upstream.cards)) cards[setId] = [...list]

  for (const set of overrides.sets ?? []) {
    const exists = sets.some(
      (s) => s.id === set.id || (set.ptcgoCode !== undefined && s.ptcgoCode === set.ptcgoCode),
    )
    if (exists) {
      warnings.push(`override set ${set.id} now exists in a source; consider removing it`)
      continue
    }
    sets.push(set)
  }

  for (const [setId, list] of Object.entries(overrides.cards ?? {})) {
    if (!sets.some((s) => s.id === setId)) {
      errors.push(`override cards reference unknown set ${setId}`)
      continue
    }
    const existing = (cards[setId] ??= [])
    for (const card of list) {
      const i = existing.findIndex(
        (c) => normalizeNumber(c.number) === normalizeNumber(card.number),
      )
      if (i >= 0) {
        warnings.push(
          `override card ${setId} #${card.number} now exists in a source; the override still wins, consider removing it`,
        )
        existing[i] = card
      } else {
        existing.push(card)
      }
    }
  }

  // Sets without a PTCG Live code can't appear in a decklist.
  const coded = sets.filter((s) => s.ptcgoCode)

  // Patches match a print ID ("PBL-42") or, when the source's number is wrong, the
  // source's own ID ("zsv10pt5-80"). They apply before print IDs are assigned, so a patch
  // can fix the number.
  for (const [key, patch] of Object.entries(overrides.patches ?? {})) {
    let found: { list: RawCard[]; i: number } | undefined
    for (const set of coded) {
      const list = cards[set.id] ?? []
      const i = list.findIndex((c) => c.id === key || printId(set.ptcgoCode!, c.number) === key)
      if (i >= 0) found = { list, i }
    }
    if (!found) {
      errors.push(`patch targets unknown card ${key}`)
      continue
    }
    const original = found.list[found.i]
    const redundant = Object.entries(patch).every(
      ([field, value]) =>
        JSON.stringify(original[field as keyof RawCard]) === JSON.stringify(value),
    )
    if (redundant) warnings.push(`patch for ${key} matches the source now; consider removing it`)
    found.list[found.i] = { ...original, ...patch }
  }

  const withIds: Record<string, RawCard[]> = {}
  for (const set of coded) {
    withIds[set.id] = (cards[set.id] ?? []).map((c) => ({
      ...c,
      id: printId(set.ptcgoCode!, c.number),
    }))
  }
  return { sets: coded, cards: withIds }
}

// ---- Normalization ----

const ENERGY_TYPES: readonly EnergyType[] = [
  'Grass',
  'Fire',
  'Water',
  'Lightning',
  'Psychic',
  'Fighting',
  'Darkness',
  'Metal',
  'Dragon',
  'Colorless',
]
const STAGES: readonly Stage[] = ['Basic', 'Stage 1', 'Stage 2']
const TRAINER_KINDS: readonly TrainerKind[] = ['Item', 'Supporter', 'Stadium', 'Pokémon Tool']
/** "Basic Fire Energy" now; older sets print "Fire Energy". Fairy is no longer a type. */
const BASIC_ENERGY_NAME =
  /^(?:Basic )?(Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy) Energy$/

/** Normalize text so trivial differences (whitespace, curly quotes) don't split reprints. */
export function cleanText(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/ ([♀♂])/g, '$1') // "Nidoran ♀" and "Nidoran♀"
    .trim()
}

/** Effect text: also tolerate a missing final period, a common typo in the sources. */
function cleanEffect(text: string): string {
  const t = cleanText(text)
  return t === '' || /[.!?)"']$/.test(t) ? t : `${t}.`
}

/**
 * Reminder text and rule boxes that follow from the card's kind or tags (Item, Supporter,
 * Stadium, Tool, ACE SPEC, ex, MEGA, Tera). Upstream includes them inconsistently between
 * prints, so they are dropped; otherwise identical reprints would not collapse.
 */
const REMINDERS: readonly RegExp[] = [
  /^You may play any number of Item cards during your turn\.$/,
  /^You may play only 1 Supporter card during your turn\.$/,
  /^You may play only 1 Stadium card during your turn\./,
  /^You may attach any number of Pokémon Tools to your Pokémon during your turn\./,
  /^Attach a Pokémon Tool to 1 of your Pokémon that doesn't already have a Pokémon Tool attached\.$/,
  /^(ACE SPEC: )?You can't have more than 1 ACE SPEC card in your deck\.$/,
  /^(Pokémon ex rule: )?When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards\.$/i,
  /^Mega Evolution ex rule: /i,
  /^(Tera: )?As long as this Pokémon is on your Bench, prevent all damage done to this Pokémon by attacks \(both yours and your opponent's\)\.$/,
]

/** One entry per paragraph (sources disagree on whether paragraphs are separate entries). */
export function cleanRules(rules: string[] | undefined): string[] {
  return (rules ?? [])
    .flatMap((r) => r.split(/\n\s*\n/))
    .map(cleanText)
    .filter((r) => r !== '' && !REMINDERS.some((re) => re.test(r)))
}

function energyType(value: string, where: string): EnergyType {
  if ((ENERGY_TYPES as readonly string[]).includes(value)) return value as EnergyType
  throw new Error(`unknown energy type "${value}" in ${where}`)
}

/** A card's game text without its identity fields (id, prints, mark). */
// (`T extends unknown ? … : never` applies Omit to each member of the union separately, so
// the `kind` discriminant still narrows the result.)
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type CardText = DistributiveOmit<Card, 'id' | 'prints' | 'mark'>

export function isBasicEnergy(raw: RawCard): boolean {
  return (
    raw.supertype === 'Energy' &&
    (raw.subtypes?.includes('Basic') || BASIC_ENERGY_NAME.test(raw.name))
  )
}

/**
 * The card's name for deck-building purposes. Upstream adds the pictured character to some
 * Trainer names ("Boss's Orders (Ghetsis)"), but the card's name is just "Boss's Orders".
 */
export function cardName(raw: RawCard): string {
  const name = cleanText(raw.name)
  return raw.supertype === 'Trainer' ? name.replace(/\s*\([^)]*\)$/, '') : name
}

/**
 * Convert an upstream card to our format. Throws with a readable message when the
 * upstream data is incomplete (fix those with a patch in data/overrides.json).
 */
export function normalizeCard(raw: RawCard): CardText {
  const subtypes = raw.subtypes ?? []
  const name = cardName(raw)
  const rules = cleanRules(raw.rules)
  const aceSpec = subtypes.includes('ACE SPEC') ? { aceSpec: true as const } : {}

  if (raw.supertype === 'Pokémon') {
    const stage = STAGES.find((s) => subtypes.includes(s))
    if (!stage) throw new Error(`Pokémon has no stage in subtypes ${JSON.stringify(subtypes)}`)
    const hp = Number(raw.hp)
    if (!Number.isInteger(hp) || hp <= 0) throw new Error(`Pokémon has invalid HP "${raw.hp}"`)
    const abilities: Ability[] = (raw.abilities ?? []).map((a) => ({
      name: cleanText(a.name),
      text: cleanEffect(a.text),
    }))
    const attacks: Attack[] = (raw.attacks ?? []).map((a) => ({
      name: cleanText(a.name),
      // Upstream writes a zero-cost attack as ["Free"].
      cost: (a.cost ?? [])
        .filter((t) => t !== 'Free')
        .map((t) => energyType(t, `attack ${a.name}`)),
      damage: a.damage ?? '',
      text: cleanEffect(a.text ?? ''),
    }))
    const weakness = raw.weaknesses?.[0]?.type
    const resistance = raw.resistances?.[0]?.type
    return {
      kind: 'pokemon',
      name,
      ...aceSpec,
      stage,
      ...(raw.evolvesFrom ? { evolvesFrom: cleanText(raw.evolvesFrom) } : {}),
      hp,
      types: (raw.types ?? []).map((t) => energyType(t, 'types')),
      tags: subtypes.filter((s) => !(STAGES as readonly string[]).includes(s)),
      abilities,
      attacks,
      ...(weakness ? { weakness: energyType(weakness, 'weakness') } : {}),
      ...(resistance ? { resistance: energyType(resistance, 'resistance') } : {}),
      retreat: raw.convertedRetreatCost ?? 0,
      rules,
    }
  }

  if (raw.supertype === 'Trainer') {
    const trainer = TRAINER_KINDS.find((k) => subtypes.includes(k))
    if (!trainer) throw new Error(`Trainer has no kind in subtypes ${JSON.stringify(subtypes)}`)
    return {
      kind: 'trainer',
      name,
      ...aceSpec,
      trainer,
      tags: subtypes.filter((s) => s !== trainer && s !== 'ACE SPEC'),
      rules,
    }
  }

  if (raw.supertype === 'Energy') {
    if (isBasicEnergy(raw)) {
      const match = BASIC_ENERGY_NAME.exec(name)
      if (!match)
        throw new Error(`basic Energy name "${name}" doesn't look like "Basic <Type> Energy"`)
      // Basic Energy has no game text, so prints collapse by type alone, under today's name.
      const provides = energyType(match[1], 'basic Energy name')
      return { kind: 'energy', name: `Basic ${provides} Energy`, basic: true, provides, rules: [] }
    }
    return { kind: 'energy', name, ...aceSpec, basic: false, rules }
  }

  throw new Error(`unknown supertype "${raw.supertype}"`)
}

/** Two prints are the same card when this key matches. */
export function gameTextKey(card: CardText): string {
  // Rules compare as one text: sources split the same text into paragraphs differently.
  return JSON.stringify({ ...card, rules: card.rules.join(' ') })
}

// ---- Build ----

interface Print {
  id: string
  mark: string | null
  /** Position of the set in release order, then the card number, for sorting prints. */
  setOrder: number
  number: string
  rarity: number
}

/**
 * 0 for regular set rarities, 1 for promos, 2 for alternate arts (full arts, illustration
 * rares, shinies, …). The display print is the newest print of the lowest rank.
 */
const REGULAR_RARITIES = ['common', 'uncommon', 'rare', 'double rare', 'ace spec rare']
function rarityRank(rarity: string | undefined): number {
  // Case varies between sources ("Double Rare", "Double rare").
  const r = rarity?.toLowerCase()
  if (r === undefined || REGULAR_RARITIES.includes(r)) return 0
  return r === 'promo' ? 1 : 2
}

/** The print the site and solver use for a card: newest regular-rarity print. */
function displayPrint(prints: Print[]): Print {
  return prints.reduce((best, p) =>
    p.rarity < best.rarity || (p.rarity === best.rarity && comparePrints(p, best) > 0) ? p : best,
  )
}

function comparePrints(a: Print, b: Print): number {
  if (a.setOrder !== b.setOrder) return a.setOrder - b.setOrder
  const na = Number(a.number)
  const nb = Number(b.number)
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
  return a.number < b.number ? -1 : a.number > b.number ? 1 : 0
}

export function buildCardData(
  upstream: Upstream,
  overrides: Overrides,
  config: Config,
  sources: CardData['sources'],
  builtAt: string,
): BuildResult {
  const warnings: string[] = []
  const errors: string[] = []
  const { sets, cards } = applyOverrides(upstream, overrides, config, warnings, errors)

  // Release order, oldest first; ties by ID so the output is deterministic.
  const orderedSets = [...sets].sort((a, b) =>
    a.releaseDate === b.releaseDate
      ? a.id < b.id
        ? -1
        : 1
      : a.releaseDate < b.releaseDate
        ? -1
        : 1,
  )
  const setOrder = new Map(orderedSets.map((s, i) => [s.id, i]))

  const hasLegalMark = (raw: RawCard) =>
    raw.regulationMark !== undefined && markIsLegal(raw.regulationMark, config.oldestLegalMark)
  // Basic Energy has no mark and every print of the current types is legal. (Fairy Energy
  // is a basic Energy too, but no current card uses the type, so it is left out.)
  const isLegalPrint = (raw: RawCard) =>
    hasLegalMark(raw) ||
    (isBasicEnergy(raw) && cleanText(raw.name).replace(/^Basic /, '') !== 'Fairy Energy')

  interface Group {
    text: CardText
    prints: Print[]
  }
  const groups = new Map<string, Group>()
  const toPrint = (raw: RawCard, setId: string): Print => ({
    id: raw.id,
    mark: raw.regulationMark ?? null,
    setOrder: setOrder.get(setId)!,
    number: raw.number,
    rarity: rarityRank(raw.rarity),
  })

  // Pass 1: every print with a legal mark defines a card.
  const olderPrints: [RawCard, string][] = []
  for (const set of orderedSets) {
    for (const raw of cards[set.id] ?? []) {
      if (!isLegalPrint(raw)) {
        olderPrints.push([raw, set.id])
        continue
      }
      let text: CardText
      try {
        text = normalizeCard(raw)
      } catch (e) {
        errors.push(`${raw.id} (${raw.name}): ${(e as Error).message}`)
        continue
      }
      const key = gameTextKey(text)
      const group = groups.get(key)
      if (group) group.prints.push(toPrint(raw, set.id))
      else groups.set(key, { text, prints: [toPrint(raw, set.id)] })
    }
  }

  // Pass 2: older prints with identical game text are the same card (and legal through
  // the reprint). Only cards sharing a name with a legal card can match.
  const legalNames = new Set([...groups.values()].map((g) => g.text.name))
  for (const [raw, setId] of olderPrints) {
    if (!legalNames.has(cardName(raw)) || isBasicEnergy(raw)) continue
    let key: string
    try {
      key = gameTextKey(normalizeCard(raw))
    } catch {
      continue // Older eras have shapes we don't model; they can't match a legal card anyway.
    }
    groups.get(key)?.prints.push(toPrint(raw, setId))
  }

  // Assemble cards.
  const result: Card[] = []
  const firstPrint = new Map<string, Print>()
  for (const { text, prints } of groups.values()) {
    prints.sort(comparePrints)
    const marks = prints.map((p) => p.mark).filter((m): m is string => m !== null)
    const mark =
      text.kind === 'energy' && text.basic ? null : (marks.sort(compareMarks).at(-1) ?? null)
    const id = displayPrint(prints).id
    firstPrint.set(id, prints[0])
    result.push({ ...text, id, mark, prints: prints.map((p) => p.id) } as Card)
  }
  // Ordered by first release, so a new reprint doesn't move a card around in the file.
  result.sort((a, b) => comparePrints(firstPrint.get(a.id)!, firstPrint.get(b.id)!))

  warnings.push(...findSuspiciousSplits(result))

  // Print IDs must be unique, or a decklist line would be ambiguous.
  const owner = new Map<string, string>()
  for (const card of result) {
    for (const print of card.prints) {
      const other = owner.get(print)
      if (other) errors.push(`print ID ${print} is used twice (${other}, ${card.name})`)
      owner.set(print, card.name)
    }
  }

  // Sets that any print uses. Codes shared by several sets (subsets) list the first.
  const usedCodes = new Set(result.flatMap((c) => c.prints.map((p) => splitPrintId(p).code)))
  const outSets: SetInfo[] = []
  for (const s of orderedSets) {
    const code = s.ptcgoCode!.toUpperCase()
    if (!usedCodes.has(code) || outSets.some((o) => o.code === code)) continue
    outSets.push({ code, name: s.name, released: s.releaseDate.replaceAll('/', '-') })
  }
  for (const [alias, target] of Object.entries(config.setCodeAliases)) {
    if (!outSets.some((s) => s.code === target))
      warnings.push(`set code alias ${alias} → ${target}: no set has code ${target}`)
  }

  return {
    data: {
      version: CARD_DATA_VERSION,
      sources,
      builtAt,
      oldestLegalMark: config.oldestLegalMark,
      setCodeAliases: config.setCodeAliases,
      sets: outSets,
      cards: result,
    },
    warnings,
    errors,
  }
}

/**
 * Trainers and Energy with one name should be one card; Pokémon with the same name, HP and
 * attack names almost certainly are too. If not, upstream text probably differs by a typo,
 * which would split one card in two (and break the 4-copy count by name only a little, but
 * the solver would treat them as different cards).
 */
function findSuspiciousSplits(cards: Card[]): string[] {
  const byKey = new Map<string, Card[]>()
  for (const card of cards) {
    const key =
      card.kind === 'pokemon'
        ? `${card.name}|${card.types.join(',')}|${card.hp}|${card.attacks.map((a) => `${a.name}:${a.cost.join('+')}:${a.damage}`).join(',')}|${card.abilities.map((a) => a.name).join(',')}`
        : `${card.kind}|${card.name}`
    byKey.set(key, [...(byKey.get(key) ?? []), card])
  }
  return [...byKey.values()]
    .filter((list) => list.length > 1)
    .map(
      (list) =>
        `possible split reprint: "${list[0].name}" appears as ${list.length} cards (${list.map((c) => c.id).join(', ')})`,
    )
}
