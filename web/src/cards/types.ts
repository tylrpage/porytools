// Types for the compact card database (`public/data/cards.json`), produced by the build
// script in `web/scripts/cards/build-cards.ts`. Both the site and the pipeline import this file,
// so it may only use TypeScript syntax that Node can strip (no enums or namespaces).

/** Bump when the shape of cards.json changes in a way old readers can't handle. */
export const CARD_DATA_VERSION = 2

/** Energy / Pokémon types as written on cards. */
export type EnergyType =
  | 'Grass'
  | 'Fire'
  | 'Water'
  | 'Lightning'
  | 'Psychic'
  | 'Fighting'
  | 'Darkness'
  | 'Metal'
  | 'Dragon'
  | 'Colorless'

export type Stage = 'Basic' | 'Stage 1' | 'Stage 2'
export type TrainerKind = 'Item' | 'Supporter' | 'Stadium' | 'Pokémon Tool'

export interface Attack {
  name: string
  cost: EnergyType[]
  /** As printed, e.g. "60+", "30×", "" for none. Damage math comes later. */
  damage: string
  text: string
}

export interface Ability {
  name: string
  text: string
}

interface CardBase {
  /**
   * The print the site and solver use for this card (e.g. "MEG-131"): the newest print
   * at regular rarity, so promos, full arts and old prints all show as that one. It can
   * change when a reprint comes out, so look cards up by any print ID (`CardDb.cardOfPrint`)
   * when the ID was stored somewhere (share links, effect files, precomputed results).
   */
  id: string
  name: string
  /**
   * Newest regulation mark among all prints. A card is Standard-legal when this is at or
   * above the oldest legal mark. `null` only for basic Energy, which is always legal.
   */
  mark: string | null
  /** Every print with identical game text (reprints collapsed), oldest first. */
  prints: string[]
  /** ACE SPEC: at most one ACE SPEC card per deck. */
  aceSpec?: true
}

export interface PokemonCard extends CardBase {
  kind: 'pokemon'
  stage: Stage
  evolvesFrom?: string
  hp: number
  types: EnergyType[]
  /** Extra labels such as "ex", "MEGA", "Tera", "Ancient", "Future". */
  tags: string[]
  abilities: Ability[]
  attacks: Attack[]
  weakness?: EnergyType
  resistance?: EnergyType
  retreat: number
  /** Rule boxes, e.g. the ex prize rule. */
  rules: string[]
}

export interface TrainerCard extends CardBase {
  kind: 'trainer'
  trainer: TrainerKind
  tags: string[]
  /** Card text. The "You may play only 1 Supporter…" style reminders are kept as-is. */
  rules: string[]
}

export interface EnergyCard extends CardBase {
  kind: 'energy'
  basic: boolean
  /** For basic Energy, the type it provides. */
  provides?: EnergyType
  rules: string[]
}

export type Card = PokemonCard | TrainerCard | EnergyCard

export interface SetInfo {
  /** Set code used by PTCG Live, e.g. "TWM". Print IDs start with it. */
  code: string
  name: string
  /** ISO date, e.g. "2024-05-24". */
  released: string
}

export interface CardData {
  version: typeof CARD_DATA_VERSION
  /** Where the data came from, for reproducibility. */
  sources: { name: string; url: string; version: string }[]
  /** Build date, e.g. "2026-11-23". */
  builtAt: string
  /** Oldest Standard-legal regulation mark (from data/config.json). */
  oldestLegalMark: string
  /** Extra set codes that decklists use, mapped to a code in `sets` (e.g. "SVP" → "PR-SV"). */
  setCodeAliases: Record<string, string>
  sets: SetInfo[]
  cards: Card[]
}
