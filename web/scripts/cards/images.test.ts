// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Card } from '../../src/cards/types.ts'
import { indexTcgdexSets, pickTcgdexImages, tcgdexImageBase } from './images.ts'
import type { TcgdexSet } from './tcgdex.ts'

const set = (id: string, code: string, localIds: string[]): TcgdexSet => ({
  id,
  name: id,
  releaseDate: '2024-01-01',
  serie: { id: 'sv' },
  abbreviation: { official: code },
  cards: localIds.map((localId) => ({ id: `${id}-${localId}`, localId, name: 'x' })),
})

const index = indexTcgdexSets(
  [set('sv06', 'TWM', ['017', '126']), set('svp', 'SVP', ['012']), set('noabbr', '', ['1'])],
  { SVP: 'PR-SV' },
)

const card = (id: string, image?: string): Card =>
  ({
    kind: 'trainer',
    id,
    name: id,
    mark: 'H',
    prints: [id],
    trainer: 'Item',
    tags: [],
    rules: [],
    ...(image ? { image } : {}),
  }) as Card

describe('TCGdex images', () => {
  it('finds a print by set code and number, ignoring zero padding, through aliases', () => {
    expect(tcgdexImageBase(index, 'TWM-17')).toBe('https://assets.tcgdex.net/en/sv/sv06/017')
    expect(tcgdexImageBase(index, 'PR-SV-12')).toBe('https://assets.tcgdex.net/en/sv/svp/012')
    expect(tcgdexImageBase(index, 'TWM-999')).toBeUndefined()
    expect(tcgdexImageBase(index, 'XYZ-1')).toBeUndefined()
  })

  it('uses the best print with a scan, else keeps the source image', async () => {
    const cards = [
      card('TWM-126'),
      card('PR-SV-12', 'https://images.pokemontcg.io/x.png'),
      card('ABC-1'),
    ]
    const missing = new Set(['https://assets.tcgdex.net/en/sv/sv06/126'])
    const stats = await pickTcgdexImages(
      cards,
      { 'TWM-126': ['TWM-126', 'TWM-17'], 'PR-SV-12': ['PR-SV-12'], 'ABC-1': ['ABC-1'] },
      index,
      async (base) => !missing.has(base) && !base.includes('/svp/'),
    )
    expect(cards.map((c) => c.image)).toEqual([
      'https://assets.tcgdex.net/en/sv/sv06/017/low.webp',
      'https://images.pokemontcg.io/x.png',
      undefined,
    ])
    expect(stats).toEqual({ tcgdex: 1, fallback: 1, none: 1 })
  })
})
