// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeCard } from './normalize.ts'
import { convertCard, convertSet, spellOutSymbols } from './tcgdex.ts'

describe('TCGdex adapter', () => {
  it('converts a set, using the official code', () => {
    expect(
      convertSet({
        id: 'mep',
        name: 'MEP Black Star Promos',
        releaseDate: '2025-09-26',
        abbreviation: { official: 'MEP' },
        cards: [],
      }),
    ).toEqual({
      id: 'tcgdex-mep',
      name: 'MEP Black Star Promos',
      ptcgoCode: 'MEP',
      releaseDate: '2025/09/26',
    })
  })

  it('spells out energy symbols the way pokemon-tcg-data does', () => {
    expect(spellOutSymbols('all of your {M} Pokémon and [R] Energy')).toBe(
      'all of your Metal Pokémon and Fire Energy',
    )
  })

  it('converts a Mega ex Pokémon', () => {
    const raw = convertCard({
      id: 'me05-115',
      localId: '115',
      name: 'Mega Chandelure ex',
      category: 'Pokemon',
      rarity: 'Special illustration rare',
      regulationMark: 'J',
      hp: 350,
      types: ['Psychic'],
      evolveFrom: 'Lampent',
      stage: 'Stage2',
      suffix: 'ex',
      abilities: [{ type: 'Ability', name: 'Binding Flame', effect: 'Retreat Cost is {C} more.' }],
      attacks: [{ name: 'Phantom Maze', cost: ['Psychic', 'Psychic'], damage: '130+' }],
      weaknesses: [{ type: 'Darkness', value: '×2' }],
      retreat: 2,
    })
    expect(normalizeCard(raw)).toMatchObject({
      kind: 'pokemon',
      stage: 'Stage 2',
      evolvesFrom: 'Lampent',
      hp: 350,
      tags: ['MEGA', 'ex'],
      abilities: [{ name: 'Binding Flame', text: 'Retreat Cost is Colorless more.' }],
      attacks: [{ name: 'Phantom Maze', cost: ['Psychic', 'Psychic'], damage: '130+', text: '' }],
      weakness: 'Darkness',
      retreat: 2,
    })
  })

  it('converts Trainers, ACE SPECs, and basic Energy', () => {
    const catcher = convertCard({
      id: 'sv05-157',
      localId: '157',
      name: 'Prime Catcher',
      category: 'Trainer',
      rarity: 'ACE SPEC Rare',
      regulationMark: 'H',
      trainerType: 'Item',
      effect: "Switch in 1 of your opponent's Benched Pokémon to the Active Spot.",
    })
    expect(normalizeCard(catcher)).toMatchObject({
      kind: 'trainer',
      trainer: 'Item',
      aceSpec: true,
    })

    const energy = convertCard({
      id: 'mee-005',
      localId: '005',
      name: 'Psychic Energy',
      category: 'Energy',
      rarity: 'Common',
      energyType: 'Normal',
    })
    expect(energy.number).toBe('005')
    expect(normalizeCard(energy)).toMatchObject({ name: 'Basic Psychic Energy', basic: true })
  })
})
