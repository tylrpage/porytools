// @vitest-environment node
// Every decklist in data/test-decklists.json (real tournament lists from Limitless) must
// parse and be a valid Standard deck with the current cards.json. A failure usually means
// a card or set code is missing from the card data.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CardDb } from '../../src/cards/db.ts'
import type { CardData } from '../../src/cards/types.ts'
import { parseDecklist } from '../../src/deck/parse.ts'
import { validateDeck } from '../../src/deck/validate.ts'
import type { TestDecklists } from './fetch-decklists.ts'

const read = <T>(path: string) =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T
const db = new CardDb(read<CardData>('../../public/data/cards.json'))
const { lists } = read<TestDecklists>('../../../data/test-decklists.json')

describe('real tournament decklists', () => {
  const cases = Object.entries(lists).map(([id, lines]) => ({ id, lines }))

  it('has lists to check', () => {
    expect(cases.length).toBeGreaterThan(0)
  })

  it.each(cases)('Limitless list $id parses and validates', ({ lines }) => {
    const { entries, problems } = parseDecklist(lines.join('\n'), db)
    expect(problems).toEqual([])
    expect(validateDeck(entries, db)).toEqual([])
  })
})
