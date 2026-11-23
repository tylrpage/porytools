// A tiny hand-made card database for tests.

import { CardDb } from './db.ts'
import type { Card, CardData, PokemonCard, TrainerCard } from './types.ts'

const pokemon = (id: string, name: string, extra: Partial<PokemonCard> = {}): PokemonCard => ({
  kind: 'pokemon',
  id,
  name,
  mark: 'H',
  prints: [id],
  stage: 'Basic',
  hp: 70,
  types: ['Psychic'],
  tags: [],
  abilities: [],
  attacks: [],
  retreat: 1,
  rules: [],
  ...extra,
})

const trainer = (id: string, name: string, extra: Partial<TrainerCard> = {}): TrainerCard => ({
  kind: 'trainer',
  id,
  name,
  mark: 'H',
  prints: [id],
  trainer: 'Item',
  tags: [],
  rules: [],
  ...extra,
})

export const fixtureCards: Card[] = [
  pokemon('TWM-128', 'Dreepy'),
  pokemon('TWM-129', 'Drakloak', { stage: 'Stage 1', evolvesFrom: 'Dreepy' }),
  pokemon('TWM-130', 'Dragapult ex', { stage: 'Stage 2', evolvesFrom: 'Drakloak', tags: ['ex'] }),
  pokemon('SSP-57', 'Pikachu ex', { types: ['Lightning'], tags: ['Tera', 'ex'] }),
  pokemon('MEG-50', 'Pikachu', { types: ['Lightning'] }),
  pokemon('PFL-60', 'Pikachu', { types: ['Lightning'], hp: 60 }),
  trainer('MEG-131', 'Ultra Ball', { mark: 'I', prints: ['BRS-150', 'SVI-196', 'MEG-131'] }),
  trainer('TEF-157', 'Prime Catcher', { aceSpec: true }),
  trainer('TEF-154', 'Maximum Belt', { aceSpec: true, trainer: 'Pokémon Tool' }),
  trainer('MEG-114', "Boss's Orders", {
    trainer: 'Supporter',
    mark: 'I',
    prints: ['PAL-172', 'MEG-114'],
  }),
  trainer('SCR-100', 'H Mark Item'),
  {
    kind: 'energy',
    id: 'SVE-13',
    name: 'Basic Psychic Energy',
    mark: null,
    prints: ['SVE-5', 'SVE-13'],
    basic: true,
    provides: 'Psychic',
    rules: [],
  },
  {
    kind: 'energy',
    id: 'SVE-2',
    name: 'Basic Fire Energy',
    mark: null,
    prints: ['SVE-2'],
    basic: true,
    provides: 'Fire',
    rules: [],
  },
  {
    kind: 'energy',
    id: 'TWM-167',
    name: 'Legacy Energy',
    mark: 'H',
    prints: ['TWM-167'],
    basic: false,
    aceSpec: true,
    rules: [],
  },
]

export const fixtureData: CardData = {
  version: 2,
  sources: [{ name: 'fixture', url: 'https://example.com', version: '0' }],
  builtAt: '2026-01-01',
  oldestLegalMark: 'H',
  setCodeAliases: { SVP: 'PR-SV' },
  sets: [
    { code: 'BRS', name: 'Brilliant Stars', released: '2022-02-25' },
    { code: 'SVI', name: 'Scarlet & Violet', released: '2023-03-31' },
    { code: 'SVE', name: 'Scarlet & Violet Energies', released: '2023-03-31' },
    { code: 'PAL', name: 'Paldea Evolved', released: '2023-06-09' },
    { code: 'TEF', name: 'Temporal Forces', released: '2024-03-22' },
    { code: 'TWM', name: 'Twilight Masquerade', released: '2024-05-24' },
    { code: 'SCR', name: 'Stellar Crown', released: '2024-09-13' },
    { code: 'SSP', name: 'Surging Sparks', released: '2024-11-08' },
    { code: 'MEG', name: 'Mega Evolution', released: '2025-09-26' },
    { code: 'PFL', name: 'Phantasmal Flames', released: '2025-11-14' },
  ],
  cards: fixtureCards,
}

export const fixtureDb = (): CardDb => new CardDb(fixtureData)
