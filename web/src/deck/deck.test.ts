import { describe, expect, it } from 'vitest'
import { basicEnergyName } from '../cards/db.ts'
import { fixtureDb } from '../cards/fixture.ts'
import { parseDecklist } from './parse.ts'
import { decodeDeck, encodeDeck, formatDecklist } from './share.ts'
import { validateDeck } from './validate.ts'

const db = fixtureDb()

const VALID = `Pokémon: 10
4 Dreepy TWM 128
3 Drakloak TWM 129
3 Dragapult ex TWM 130

Trainer: 9
2 Ultra Ball SVI 196
2 Ultra Ball MEG 131
1 Prime Catcher TEF 157
4 Boss's Orders MEG 114

Energy: 41
41 Basic {P} Energy SVE 5

Total Cards: 60`

const parse = (text: string) => parseDecklist(text, db)
const errorsOf = (text: string) => {
  const { entries } = parse(text)
  return validateDeck(entries, db).map((p) => p.message)
}

describe('parseDecklist', () => {
  it('reads a PTCG Live export, skipping headers and totals, merging prints of a card', () => {
    const { entries, problems } = parse(VALID)
    expect(problems).toEqual([])
    expect(entries.map((e) => [e.count, e.card.name, e.card.id])).toEqual([
      [4, 'Dreepy', 'TWM-128'],
      [3, 'Drakloak', 'TWM-129'],
      [3, 'Dragapult ex', 'TWM-130'],
      [4, 'Ultra Ball', 'MEG-131'],
      [1, 'Prime Catcher', 'TEF-157'],
      [4, "Boss's Orders", 'MEG-114'],
      [41, 'Basic Psychic Energy', 'SVE-13'],
    ])
  })

  it('maps older prints and promos to the display print, keeping the listed print', () => {
    const { entries, lines, problems } = parse("4 Ultra Ball BRS 150\n2 Boss's Orders PAL 172")
    expect(problems).toEqual([])
    expect(entries.map((e) => e.card.id)).toEqual(['MEG-131', 'MEG-114'])
    expect(lines.map((l) => l.printId)).toEqual(['BRS-150', 'PAL-172'])
  })

  it('reads set codes that start with a digit', () => {
    // An unknown print falls back to the name, which only works if "30C 999" was split
    // off as a set code and number.
    const { entries, problems } = parse('4 Dreepy 30C 999')
    expect(entries[0].card.name).toBe('Dreepy')
    expect(problems).toEqual([
      {
        severity: 'warning',
        line: 1,
        message: 'Didn\'t recognize 30C 999; matched "Dreepy" by name',
      },
    ])
  })

  it('accepts Trainer names with the pictured character', () => {
    const { entries, problems } = parse("2 Boss's Orders (Ghetsis)")
    expect(problems).toEqual([])
    expect(entries[0].card.name).toBe("Boss's Orders")
  })

  it('accepts "4x", lowercase codes, leading zeros, and curly apostrophes', () => {
    const { entries, problems } = parse('4x Dreepy twm 0128\n1 Boss’s Orders')
    expect(problems).toEqual([])
    expect(entries.map((e) => e.card.name)).toEqual(['Dreepy', "Boss's Orders"])
  })

  it('reads basic Energy however it is written', () => {
    const { entries, problems } = parse(
      [
        '1 Basic {P} Energy SVE 13',
        '1 Psychic Energy',
        '1 {P} Energy Energy 5',
        '1 Psychic Energy MEE',
        '1 Psychic Energy MEE 5',
        '1 Basic Fire Energy',
      ].join('\n'),
    )
    expect(problems).toEqual([])
    expect(entries.map((e) => [e.count, e.card.name])).toEqual([
      [5, 'Basic Psychic Energy'],
      [1, 'Basic Fire Energy'],
    ])
  })

  it('matches by name when there is no set code, if the name is unambiguous', () => {
    const { entries, problems } = parse('2 Dreepy')
    expect(problems).toEqual([])
    expect(entries[0].card.id).toBe('TWM-128')
  })

  it('asks for a set code when several cards share a name', () => {
    const { entries, problems } = parse('4 Pikachu')
    expect(entries).toEqual([])
    expect(problems[0]).toMatchObject({ severity: 'error', line: 1 })
    expect(problems[0].message).toMatch(/2 different cards named Pikachu.*MEG 50.*PFL 60/)
  })

  it('reports unknown cards and unreadable lines with line numbers', () => {
    const { problems } = parse('Pokémon: 1\n4 Missingno XYZ 1\nnonsense here')
    expect(problems).toEqual([
      { severity: 'error', line: 2, message: "Missingno XYZ 1 isn't a known Standard-legal card" },
      { severity: 'error', line: 3, message: 'Couldn\'t read "nonsense here"' },
    ])
  })

  it('falls back to the name for an unknown set code, with a warning', () => {
    const { entries, problems } = parse('4 Dreepy NEW 12')
    expect(entries[0].card.name).toBe('Dreepy')
    expect(problems).toEqual([
      {
        severity: 'warning',
        line: 1,
        message: 'Didn\'t recognize NEW 12; matched "Dreepy" by name',
      },
    ])
  })

  it('trusts the set code over a mismatched name, with a warning', () => {
    const { entries, problems } = parse('4 Drakloak TWM 128')
    expect(entries[0].card.name).toBe('Dreepy')
    expect(problems[0]).toMatchObject({ severity: 'warning', line: 1 })
  })
})

describe('basicEnergyName', () => {
  it('normalizes the common spellings', () => {
    expect(basicEnergyName('Basic {D} Energy')).toBe('Basic Darkness Energy')
    expect(basicEnergyName('{m} energy')).toBe('Basic Metal Energy')
    expect(basicEnergyName('Lightning Energy')).toBe('Basic Lightning Energy')
    expect(basicEnergyName('Basic Water Energy')).toBe('Basic Water Energy')
  })

  it('rejects Special Energy and non-basic types', () => {
    expect(basicEnergyName('Legacy Energy')).toBeNull()
    expect(basicEnergyName('{C} Energy')).toBeNull()
    expect(basicEnergyName('Dragon Energy')).toBeNull()
  })
})

describe('validateDeck', () => {
  it('accepts a legal 60-card deck', () => {
    expect(errorsOf(VALID)).toEqual([])
  })

  it('requires exactly 60 cards', () => {
    expect(errorsOf(VALID.replace('41 Basic', '40 Basic'))).toEqual([
      'The deck has 59 cards; it needs exactly 60',
    ])
  })

  it('counts copies by name across prints, but not basic Energy', () => {
    const deck = VALID.replace('2 Ultra Ball MEG 131', '3 Ultra Ball MEG 131').replace(
      '41 Basic',
      '40 Basic',
    )
    expect(errorsOf(deck)).toEqual(['5 copies of Ultra Ball; the limit is 4'])
  })

  it('allows only one ACE SPEC, Energy included', () => {
    const deck = VALID.replace(
      '41 Basic {P} Energy SVE 5',
      '40 Basic {P} Energy SVE 5\n1 Legacy Energy TWM 167',
    )
    expect(errorsOf(deck)).toEqual([
      '2 ACE SPEC cards (Prime Catcher, Legacy Energy); a deck may have only 1',
    ])
  })

  it('needs a Basic Pokémon', () => {
    const deck = VALID.replace('4 Dreepy TWM 128', '').replace('41 Basic', '45 Basic')
    expect(errorsOf(deck)).toEqual(['The deck has no Basic Pokémon'])
  })

  it('checks legality against the chosen oldest mark', () => {
    const { entries } = parse(VALID.replace('41 Basic', '40 Basic') + '\n1 H Mark Item SCR 100')
    expect(validateDeck(entries, db).map((p) => p.message)).toEqual([])
    const errors = validateDeck(entries, db, 'I').map((p) => p.message)
    // Ultra Ball and Boss's Orders have I-mark prints, so they stay legal.
    expect(errors).toEqual([
      "Dreepy isn't Standard-legal (needs regulation mark I or newer; its newest is H)",
      "Drakloak isn't Standard-legal (needs regulation mark I or newer; its newest is H)",
      "Dragapult ex isn't Standard-legal (needs regulation mark I or newer; its newest is H)",
      "Prime Catcher isn't Standard-legal (needs regulation mark I or newer; its newest is H)",
      "H Mark Item isn't Standard-legal (needs regulation mark I or newer; its newest is H)",
    ])
  })
})

describe('sharing', () => {
  it('keeps the prints as written in share links, while entries merge by card', () => {
    const { entries, lines } = parse(VALID)
    const encoded = encodeDeck(lines)
    expect(encoded).toBe(
      '2.4_TWM-128.3_TWM-129.3_TWM-130.2_SVI-196.2_MEG-131.1_TEF-157.4_MEG-114.41_SVE-5',
    )
    expect(encoded).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(decodeDeck(encoded, db)).toEqual({ entries, lines, problems: [] })
  })

  it('reports unknown cards in a share link', () => {
    const { entries, problems } = decodeDeck('2.4_TWM-128.2_ZZZ-1', db)
    expect(entries).toHaveLength(1)
    expect(problems[0].message).toMatch(/ZZZ-1/)
  })

  it('exports the list as written, which parses back to the same lines', () => {
    const { lines } = parse(VALID)
    const text = formatDecklist(lines, db)
    expect(text).toBe(VALID)
    expect(parse(text).lines).toEqual(lines)
  })

  it('uses the display print for lines that named no print', () => {
    const { lines } = parse('4 Ultra Ball')
    expect(lines[0].printId).toBe('MEG-131')
  })
})
