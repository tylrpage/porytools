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
  pokemon('sv6-128', 'Dreepy'),
  pokemon('sv6-129', 'Drakloak', { stage: 'Stage 1', evolvesFrom: 'Dreepy' }),
  pokemon('sv6-130', 'Dragapult ex', { stage: 'Stage 2', evolvesFrom: 'Drakloak', tags: ['ex'] }),
  pokemon('sv8-57', 'Pikachu ex', { types: ['Lightning'], tags: ['Tera', 'ex'] }),
  pokemon('me1-50', 'Pikachu', { types: ['Lightning'] }),
  pokemon('me2-60', 'Pikachu', { types: ['Lightning'], hp: 60 }),
  trainer('me1-131', 'Ultra Ball', { mark: 'I', prints: ['swsh9-150', 'sv1-196', 'me1-131'] }),
  trainer('sv5-157', 'Prime Catcher', { aceSpec: true }),
  trainer('sv5-154', 'Maximum Belt', { aceSpec: true, trainer: 'Pokémon Tool' }),
  trainer('me1-114', "Boss's Orders", {
    trainer: 'Supporter',
    mark: 'I',
    prints: ['sv2-172', 'me1-114'],
  }),
  trainer('sv7-100', 'H Mark Item'),
  {
    kind: 'energy',
    id: 'sve-13',
    name: 'Basic Psychic Energy',
    mark: null,
    prints: ['sve-5', 'sve-13'],
    basic: true,
    provides: 'Psychic',
    rules: [],
  },
  {
    kind: 'energy',
    id: 'sve-2',
    name: 'Basic Fire Energy',
    mark: null,
    prints: ['sve-2'],
    basic: true,
    provides: 'Fire',
    rules: [],
  },
  {
    kind: 'energy',
    id: 'sv6-167',
    name: 'Legacy Energy',
    mark: 'H',
    prints: ['sv6-167'],
    basic: false,
    aceSpec: true,
    rules: [],
  },
]

export const fixtureData: CardData = {
  version: 1,
  source: { repo: 'test/fixture', commit: '0', fetchedAt: '2026-01-01' },
  oldestLegalMark: 'H',
  setCodeAliases: { SVP: 'PR-SV' },
  sets: [
    { id: 'swsh9', code: 'BRS', name: 'Brilliant Stars', released: '2022-02-25' },
    { id: 'sv1', code: 'SVI', name: 'Scarlet & Violet', released: '2023-03-31' },
    { id: 'sv2', code: 'PAL', name: 'Paldea Evolved', released: '2023-06-09' },
    { id: 'sve', code: 'SVE', name: 'Scarlet & Violet Energies', released: '2023-03-31' },
    { id: 'sv5', code: 'TEF', name: 'Temporal Forces', released: '2024-03-22' },
    { id: 'sv6', code: 'TWM', name: 'Twilight Masquerade', released: '2024-05-24' },
    { id: 'sv7', code: 'SCR', name: 'Stellar Crown', released: '2024-09-13' },
    { id: 'sv8', code: 'SSP', name: 'Surging Sparks', released: '2024-11-08' },
    { id: 'me1', code: 'MEG', name: 'Mega Evolution', released: '2025-09-26' },
    { id: 'me2', code: 'PFL', name: 'Phantasmal Flames', released: '2025-11-14' },
  ],
  cards: fixtureCards,
}

export const fixtureDb = (): CardDb => new CardDb(fixtureData)
