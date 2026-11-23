// @vitest-environment node
// Checks against the real generated public/data/cards.json, so a bad rebuild fails CI.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseDecklist } from '../../src/deck/parse.ts'
import { validateDeck } from '../../src/deck/validate.ts'
import { CardDb } from '../../src/cards/db.ts'
import type { CardData } from '../../src/cards/types.ts'

const data = JSON.parse(
  readFileSync(new URL('../../public/data/cards.json', import.meta.url), 'utf8'),
) as CardData
const db = new CardDb(data)

describe('cards.json', () => {
  it('has unique card IDs and prints', () => {
    const ids = data.cards.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const prints = data.cards.flatMap((c) => c.prints)
    expect(new Set(prints).size).toBe(prints.length)
  })

  it('has every card legal under the configured oldest mark', () => {
    expect(data.cards.filter((c) => !db.isLegal(c)).map((c) => c.id)).toEqual([])
  })

  it('has all eight basic Energy types', () => {
    const basics = data.cards.filter((c) => c.kind === 'energy' && c.basic).map((c) => c.name)
    expect(basics.sort()).toEqual(
      ['Darkness', 'Fighting', 'Fire', 'Grass', 'Lightning', 'Metal', 'Psychic', 'Water'].map(
        (t) => `Basic ${t} Energy`,
      ),
    )
  })

  it('reads and validates a real decklist', () => {
    const list = `Pokémon: 12
4 Dreepy TWM 128
4 Drakloak TWM 129
3 Dragapult ex TWM 130
1 Fezandipiti ex SFA 38

Trainer: 21
4 Ultra Ball SVI 196
4 Buddy-Buddy Poffin TEF 144
4 Rare Candy MEG 125
2 Boss's Orders MEG 114
2 Boss's Orders PAL 172
4 Switch SVI 194
1 Prime Catcher TEF 157

Energy: 27
14 Basic {P} Energy SVE 5
4 Psychic Energy MEE
5 Basic {R} Energy SVE 2
4 Fire Energy SVE 10`
    const { entries, problems } = parseDecklist(list, db)
    expect(problems).toEqual([])
    expect(validateDeck(entries, db)).toEqual([])
    const boss = entries.find((e) => e.card.name === "Boss's Orders")
    expect(boss?.count).toBe(4)
    expect(entries.filter((e) => e.card.kind === 'energy').map((e) => e.count)).toEqual([18, 9])
  })
})
