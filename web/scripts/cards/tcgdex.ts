// Adapter for TCGdex (https://tcgdex.dev, MIT-licensed data), used for sets that
// pokemon-tcg-data doesn't have (data/config.json `tcgdexSets`). It converts TCGdex's
// shapes into pokemon-tcg-data's, so the rest of the pipeline treats both alike.

import type { RawCard, RawSet } from './normalize.ts'

export interface TcgdexSet {
  id: string
  name: string
  releaseDate: string
  serie?: { id: string }
  abbreviation?: { official?: string }
  cards: { id: string; localId: string; name: string }[]
}

export interface TcgdexCard {
  id: string
  localId: string
  name: string
  category: 'Pokemon' | 'Trainer' | 'Energy'
  rarity?: string
  regulationMark?: string
  /** Image base URL; append "/low.webp" (about 245×337) or "/high.webp". */
  image?: string
  hp?: number
  types?: string[]
  evolveFrom?: string
  stage?: string
  suffix?: string
  abilities?: { type?: string; name: string; effect: string }[]
  attacks?: { name: string; cost?: string[]; damage?: number | string; effect?: string }[]
  weaknesses?: { type: string; value?: string }[]
  resistances?: { type: string; value?: string }[]
  retreat?: number
  effect?: string
  trainerType?: string
  energyType?: string
}

const SYMBOLS: Record<string, string> = {
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

/** TCGdex writes "{M} Pokémon" (sometimes "[M]"); pokemon-tcg-data writes "Metal Pokémon". */
export function spellOutSymbols(text: string): string {
  return text.replace(/[{[]([A-Z])[}\]]/g, (m, s: string) => SYMBOLS[s] ?? m)
}

const STAGES: Record<string, string> = { Basic: 'Basic', Stage1: 'Stage 1', Stage2: 'Stage 2' }
const TRAINER_KINDS: Record<string, string> = {
  Item: 'Item',
  Supporter: 'Supporter',
  Stadium: 'Stadium',
  Tool: 'Pokémon Tool',
}

export function convertSet(set: TcgdexSet): RawSet {
  return {
    id: `tcgdex-${set.id}`,
    name: set.name,
    ptcgoCode: set.abbreviation?.official,
    releaseDate: set.releaseDate.replaceAll('-', '/'),
  }
}

/**
 * Convert one card. TCGdex has no Tera / Ancient / Future labels and no rule boxes, so
 * those come out missing; if that splits a reprint, the build warns and a patch in
 * data/overrides.json fixes it. MEGA is inferred from the name.
 */
export function convertCard(card: TcgdexCard): RawCard {
  const text = (s: string | undefined) => spellOutSymbols(s ?? '')
  const subtypes: string[] = []
  const base = {
    id: card.id,
    name: card.name,
    number: card.localId,
    rarity: card.rarity,
    ...(card.image
      ? { images: { small: `${card.image}/low.webp`, large: `${card.image}/high.webp` } }
      : {}),
    ...(card.regulationMark ? { regulationMark: card.regulationMark } : {}),
  }

  if (card.category === 'Pokemon') {
    if (card.stage && STAGES[card.stage]) subtypes.push(STAGES[card.stage])
    if (card.suffix === 'ex' && card.name.startsWith('Mega ')) subtypes.push('MEGA')
    if (card.suffix === 'ex') subtypes.push('ex')
    return {
      ...base,
      supertype: 'Pokémon',
      subtypes,
      hp: card.hp === undefined ? undefined : String(card.hp),
      types: card.types,
      ...(card.evolveFrom ? { evolvesFrom: card.evolveFrom } : {}),
      abilities: (card.abilities ?? []).map((a) => ({
        name: a.name,
        text: text(a.effect),
        type: a.type,
      })),
      attacks: (card.attacks ?? []).map((a) => ({
        name: a.name,
        cost: a.cost ?? [],
        damage: a.damage === undefined ? '' : String(a.damage),
        text: text(a.effect),
      })),
      weaknesses: card.weaknesses,
      resistances: card.resistances,
      convertedRetreatCost: card.retreat ?? 0,
    }
  }

  const aceSpec = card.rarity === 'ACE SPEC Rare'
  if (card.category === 'Trainer') {
    if (card.trainerType && TRAINER_KINDS[card.trainerType]) {
      subtypes.push(TRAINER_KINDS[card.trainerType])
    }
    if (aceSpec) subtypes.push('ACE SPEC')
    return {
      ...base,
      supertype: 'Trainer',
      subtypes,
      rules: card.effect ? [text(card.effect)] : [],
    }
  }

  subtypes.push(card.energyType === 'Normal' ? 'Basic' : 'Special')
  if (aceSpec) subtypes.push('ACE SPEC')
  return { ...base, supertype: 'Energy', subtypes, rules: card.effect ? [text(card.effect)] : [] }
}
