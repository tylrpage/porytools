// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildCardData,
  type Config,
  type Overrides,
  type RawCard,
  type RawSet,
  type Upstream,
} from './normalize.ts'

const config: Config = { oldestLegalMark: 'H', setCodeAliases: {} }
const sources = [{ name: 'test', url: 'https://example.com', version: '0' }]
const builtAt = '2026-01-01'

const sets: RawSet[] = [
  { id: 'old1', name: 'Old Set', ptcgoCode: 'OLD', releaseDate: '2020/01/01' },
  { id: 'sv1', name: 'Scarlet & Violet', ptcgoCode: 'SVI', releaseDate: '2023/03/31' },
  { id: 'sv5', name: 'Temporal Forces', ptcgoCode: 'TEF', releaseDate: '2024/03/22' },
  { id: 'me1', name: 'Mega Evolution', ptcgoCode: 'MEG', releaseDate: '2025/09/26' },
]

const item = (id: string, name: string, mark: string | undefined, rules: string[]): RawCard => ({
  id,
  name,
  supertype: 'Trainer',
  subtypes: ['Item'],
  number: id.split('-')[1],
  regulationMark: mark,
  rules,
})

const ULTRA =
  'Search your deck for a Pokémon, reveal it, and put it into your hand. Then, shuffle your deck.'
const ITEM_REMINDER = 'You may play any number of Item cards during your turn.'

const dreepy: RawCard = {
  id: 'sv5-10',
  name: 'Dreepy',
  supertype: 'Pokémon',
  subtypes: ['Basic'],
  number: '10',
  regulationMark: 'H',
  hp: '70',
  types: ['Dragon'],
  attacks: [{ name: 'Tackle', cost: ['Free'], damage: '10', text: '' }],
  weaknesses: [],
  convertedRetreatCost: 1,
}

function upstream(cards: Record<string, RawCard[]>): Upstream {
  return { sets, cards }
}

const build = (cards: Record<string, RawCard[]>, overrides: Overrides = {}) =>
  buildCardData(upstream(cards), overrides, config, sources, builtAt)

describe('buildCardData', () => {
  it('collapses reprints, ignoring reminder text and whitespace, and makes older prints legal', () => {
    const { data, errors, warnings } = build({
      old1: [item('old1-5', 'Ultra Ball', 'D', [ULTRA])],
      sv1: [item('sv1-196', 'Ultra Ball', 'G', [ULTRA, ITEM_REMINDER])],
      me1: [item('me1-131', 'Ultra Ball', 'I', [`  ${ULTRA.replace(', ', ',\n')}`])],
    })
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(data.cards).toHaveLength(1)
    expect(data.cards[0]).toMatchObject({
      id: 'MEG-131', // newest regular-rarity print
      mark: 'I', // newest mark wins
      prints: ['OLD-5', 'SVI-196', 'MEG-131'],
      rules: [ULTRA],
    })
    expect(data.sets.map((s) => s.code)).toEqual(['OLD', 'SVI', 'MEG'])
  })

  it('shows the newest regular-rarity print, not promos or alternate arts', () => {
    const ball = (id: string, rarity: string): RawCard => ({
      ...item(id, 'Ultra Ball', 'I', [ULTRA]),
      rarity,
    })
    const { data } = build({
      sv1: [ball('sv1-196', 'Uncommon')],
      sv5: [ball('sv5-200', 'Promo')],
      me1: [ball('me1-131', 'Uncommon'), ball('me1-250', 'Illustration Rare')],
    })
    expect(data.cards[0]).toMatchObject({
      id: 'MEG-131',
      prints: ['SVI-196', 'TEF-200', 'MEG-131', 'MEG-250'],
    })
    const promoOnly = build({
      sv5: [ball('sv5-200', 'Promo')],
      me1: [ball('me1-250', 'Hyper Rare')],
    })
    expect(promoOnly.data.cards[0].id).toBe('TEF-200')
  })

  it("uses the display print's image, else the best print with one, without splitting reprints", () => {
    const ball = (id: string, image?: string, rarity = 'Uncommon'): RawCard => ({
      ...item(id, 'Ultra Ball', 'I', [ULTRA]),
      rarity,
      ...(image ? { images: { small: `https://images.pokemontcg.io/${image}` } } : {}),
    })
    const both = build({ sv1: [ball('sv1-196', 'svi.png')], me1: [ball('me1-131', 'meg.png')] })
    expect(both.data.cards).toHaveLength(1)
    expect(both.data.cards[0]).toMatchObject({
      id: 'MEG-131',
      image: 'https://images.pokemontcg.io/meg.png',
    })
    // No scan of the display print: an older regular print beats a newer full art.
    const fallback = build({
      sv1: [ball('sv1-196', 'svi.png')],
      me1: [ball('me1-131'), ball('me1-250', 'full-art.png', 'Illustration Rare')],
    })
    expect(fallback.data.cards[0]).toMatchObject({
      id: 'MEG-131',
      image: 'https://images.pokemontcg.io/svi.png',
    })
    expect(fallback.preferredPrints['MEG-131']).toEqual(['MEG-131', 'SVI-196', 'MEG-250'])
    const none = build({ me1: [ball('me1-131')] })
    expect(none.data.cards[0]).not.toHaveProperty('image')
    // Scrydex links are dropped (terms not cleared).
    const scrydex = build({
      me1: [
        {
          ...ball('me1-131'),
          images: { small: 'https://images.scrydex.com/pokemon/me1-131/small' },
        },
      ],
    })
    expect(scrydex.data.cards[0]).not.toHaveProperty('image')
    // An empty or relative URL upstream is skipped, not a build failure.
    for (const small of ['', 'meg/131.png']) {
      const bad = build({ me1: [{ ...ball('me1-131'), images: { small } }] })
      expect(bad.data.cards[0]).not.toHaveProperty('image')
    }
  })

  it('drops the pictured character from Trainer names, so those prints merge', () => {
    const boss = (id: string, name: string, mark: string) => ({
      ...item(id, name, mark, [
        "Switch in 1 of your opponent's Benched Pokémon to the Active Spot.",
      ]),
      subtypes: ['Supporter'],
    })
    const { data } = build({
      sv1: [boss('sv1-172', "Boss's Orders (Ghetsis)", 'G')],
      me1: [boss('me1-114', "Boss's Orders", 'I')],
    })
    expect(data.cards).toHaveLength(1)
    expect(data.cards[0]).toMatchObject({ name: "Boss's Orders", prints: ['SVI-172', 'MEG-114'] })
  })

  it('drops cards with no legal print', () => {
    const { data } = build({ sv1: [item('sv1-181', 'Nest Ball', 'G', ['Search…'])] })
    expect(data.cards).toEqual([])
  })

  it('keeps cards with different text apart', () => {
    const { data, warnings } = build({
      sv5: [item('sv5-1', 'Thing', 'H', ['Draw 2 cards.'])],
      me1: [item('me1-1', 'Thing', 'I', ['Draw 3 cards.'])],
    })
    expect(data.cards.map((c) => c.id)).toEqual(['TEF-1', 'MEG-1'])
    expect(warnings).toEqual(['possible split reprint: "Thing" appears as 2 cards (TEF-1, MEG-1)'])
  })

  it('treats every basic Energy print of a type as one always-legal card', () => {
    const energy = (id: string, name: string): RawCard => ({
      id,
      name,
      supertype: 'Energy',
      subtypes: ['Basic'],
      number: id.split('-')[1],
    })
    const { data } = build({
      old1: [energy('old1-99', 'Fire Energy')],
      sv1: [energy('sv1-2', 'Basic Fire Energy')],
    })
    expect(data.cards).toEqual([
      {
        kind: 'energy',
        name: 'Basic Fire Energy',
        basic: true,
        provides: 'Fire',
        rules: [],
        id: 'SVI-2',
        mark: null,
        prints: ['OLD-99', 'SVI-2'],
      },
    ])
  })

  it('prefers the lowest number of the newest set (the plain design of an Energy set)', () => {
    const energy = (id: string, image: string): RawCard => ({
      id,
      name: 'Basic Grass Energy',
      supertype: 'Energy',
      subtypes: ['Basic'],
      number: id.split('-')[1],
      images: { small: `https://images.pokemontcg.io/${image}` },
    })
    const { data, preferredPrints } = build({
      sv1: [energy('sv1-1', 'svi-1.png')],
      me1: [energy('me1-1', 'meg-1.png'), energy('me1-9', 'meg-9.png')],
    })
    expect(data.cards[0]).toMatchObject({
      id: 'MEG-1',
      image: 'https://images.pokemontcg.io/meg-1.png',
    })
    expect(preferredPrints['MEG-1']).toEqual(['MEG-1', 'MEG-9', 'SVI-1'])
  })

  it('normalizes Pokémon, including zero-cost attacks', () => {
    const { data } = build({ sv5: [dreepy] })
    expect(data.cards[0]).toEqual({
      kind: 'pokemon',
      name: 'Dreepy',
      stage: 'Basic',
      hp: 70,
      types: ['Dragon'],
      tags: [],
      abilities: [],
      attacks: [{ name: 'Tackle', cost: [], damage: '10', text: '' }],
      retreat: 1,
      rules: [],
      id: 'TEF-10',
      mark: 'H',
      prints: ['TEF-10'],
    })
  })

  it('flags ACE SPEC and keeps other subtypes as tags', () => {
    const raw = {
      ...item('sv5-157', 'Prime Catcher', 'H', ['Switch…']),
      subtypes: ['Item', 'ACE SPEC', 'Future'],
    }
    const { data } = build({ sv5: [raw] })
    expect(data.cards[0]).toMatchObject({ trainer: 'Item', aceSpec: true, tags: ['Future'] })
  })

  it('reports incomplete upstream data as errors', () => {
    const { errors } = build({ sv5: [{ ...dreepy, subtypes: [] }] })
    expect(errors).toEqual(['TEF-10 (Dreepy): Pokémon has no stage in subtypes []'])
  })

  it('applies patches, and warns when a patch is no longer needed', () => {
    const fixed = build(
      { sv5: [{ ...dreepy, subtypes: [] }] },
      { patches: { 'sv5-10': { subtypes: ['Basic'] } } },
    )
    expect(fixed.errors).toEqual([])
    expect(fixed.data.cards).toHaveLength(1)

    const redundant = build({ sv5: [dreepy] }, { patches: { 'sv5-10': { subtypes: ['Basic'] } } })
    expect(redundant.warnings).toEqual([
      'patch for sv5-10 matches the source now; consider removing it',
    ])

    const unknown = build({ sv5: [dreepy] }, { patches: { 'sv5-999': { hp: '80' } } })
    expect(unknown.errors).toEqual(['patch targets unknown card sv5-999'])
  })

  it('matches patches by print ID too, and a patch can fix a wrong number', () => {
    const byPrintId = build(
      { sv5: [{ ...dreepy, subtypes: [] }] },
      { patches: { 'TEF-10': { subtypes: ['Basic'] } } },
    )
    expect(byPrintId.errors).toEqual([])

    const wrongNumber = { ...item('sv5-80', 'Fossil', 'H', ['Play as a Basic.']), number: '10' }
    const clash = build({ sv5: [dreepy, wrongNumber] })
    expect(clash.errors).toEqual(['print ID TEF-10 is used twice (Dreepy, Fossil)'])
    const fixed = build({ sv5: [dreepy, wrongNumber] }, { patches: { 'sv5-80': { number: '80' } } })
    expect(fixed.errors).toEqual([])
    expect(fixed.data.cards.map((c) => c.id)).toEqual(['TEF-10', 'TEF-80'])
  })

  it('leaves out excluded sets and sets without a PTCG Live code', () => {
    const extra: RawSet[] = [
      { id: 'sv5c', name: 'Classic', ptcgoCode: 'TEF', releaseDate: '2024/03/22' },
      { id: 'nocode', name: 'No Code', releaseDate: '2024/03/22' },
    ]
    const { data, errors } = buildCardData(
      { sets: [...sets, ...extra], cards: { sv5: [dreepy], sv5c: [dreepy], nocode: [dreepy] } },
      {},
      { ...config, excludeSets: ['sv5c'] },
      sources,
      builtAt,
    )
    expect(errors).toEqual([])
    expect(data.cards.map((c) => c.prints)).toEqual([['TEF-10']])
  })

  it('adds sets and cards from overrides', () => {
    const newSet: RawSet = {
      id: 'me9',
      name: 'Future Set',
      ptcgoCode: 'FUT',
      releaseDate: '2027/01/01',
    }
    const { data, errors } = build(
      { sv5: [dreepy] },
      {
        sets: [newSet],
        cards: { me9: [{ ...dreepy, id: 'me9-1', number: '1', regulationMark: 'J' }] },
      },
    )
    expect(errors).toEqual([])
    expect(data.cards[0]).toMatchObject({ id: 'FUT-1', mark: 'J', prints: ['TEF-10', 'FUT-1'] })
    expect(data.sets.at(-1)).toEqual({
      code: 'FUT',
      name: 'Future Set',
      released: '2027-01-01',
    })
  })

  it('follows the configured oldest legal mark', () => {
    const cards = { sv5: [dreepy], me1: [item('me1-1', 'New Item', 'I', ['Draw 2 cards.'])] }
    const later = buildCardData(
      upstream(cards),
      {},
      { ...config, oldestLegalMark: 'I' },
      sources,
      builtAt,
    )
    expect(later.data.cards.map((c) => c.name)).toEqual(['New Item'])
    expect(later.data.oldestLegalMark).toBe('I')
  })
})
