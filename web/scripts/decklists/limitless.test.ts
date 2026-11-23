// @vitest-environment node
// Hand-written snippets in the shape of limitlesstcg.com's markup (as of November 2026).

import { describe, expect, it } from 'vitest'
import { decodeHtml, parseArchetypeIds, parseDecklistPage, parseListIds } from './limitless.ts'

const INDEX = `
<table class="data-table striped">
  <tr><th>#</th><th></th><th>Deck</th><th>Points</th><th>Share</th></tr>
  <tr><td>1</td><td></td><td><a href="/decks/284">Dragapult ex</a></td><td>1</td><td>1%</td></tr>
  <tr><td>2</td><td></td><td><a href="/decks/339">Basic Box</a></td><td>1</td><td>1%</td></tr>
</table>`

const ARCHETYPE = `
<table class="data-table striped">
  <tr><th class="sub-heading" colspan=5><a href="/tournaments/574">A tournament</a></th></tr>
  <tr><td></td><td>3rd</td><td></td><td></td><td><a href="/decks/list/31361"></a></td></tr>
  <tr><td></td><td>4th</td><td></td><td></td><td><a href="/decks/list/29678"></a></td></tr>
  <tr><td></td><td>8th</td><td></td><td></td><td><a href="/decks/list/29678"></a></td></tr>
</table>`

const card = (type: string, name: string, set: string, number: string, count: number) => `
  <div class="decklist-card" data-id="1" data-set="${set}" data-number="${number}" data-lang="en"
    data-type="${type}" data-name="${name}" data-image="x.png">
    <a class="card-link" href="/cards/${set}/${number}">
      <span class="card-count">${count}</span>
      <span class="card-name">${name}</span>
    </a>
  </div>`

const LIST = `
<div data-text-decklist>
  <div class="decklist-column-heading">Pokémon (7)</div>
  ${card('pokemon', 'Dreepy', 'TWM', '128', 4)}
  ${card('pokemon', 'Dragapult ex', 'TWM', '130', 3)}
  <div class="decklist-column-heading">Trainer (4)</div>
  ${card('trainer', 'Boss&#039;s Orders', 'MEG', '114', 4)}
  <div class="decklist-column-heading">Energy (3)</div>
  ${card('energy', 'Psychic Energy', 'MEE', '13', 3)}
</div>`

describe('Limitless parsers', () => {
  it('decodes HTML entities', () => {
    expect(decodeHtml('N&#039;s &amp; Pok&eacute;mon &#x2013; &quot;x&quot;')).toBe(
      'N\'s & Pok&eacute;mon – "x"',
    )
  })

  it('finds archetype IDs on the deck index', () => {
    expect(parseArchetypeIds(INDEX)).toEqual([284, 339])
  })

  it('finds list IDs on an archetype page, without duplicates', () => {
    expect(parseListIds(ARCHETYPE)).toEqual([31361, 29678])
  })

  it('reads a decklist page into PTCG Live format', () => {
    expect(parseDecklistPage(LIST)).toEqual([
      'Pokémon: 7',
      '4 Dreepy TWM 128',
      '3 Dragapult ex TWM 130',
      'Trainer: 4',
      "4 Boss's Orders MEG 114",
      'Energy: 3',
      '3 Psychic Energy MEE 13',
    ])
  })

  it('fails loudly on a card it cannot read', () => {
    expect(() => parseDecklistPage('<div class="decklist-card" data-type="pokemon">')).toThrow(
      /unreadable decklist card/,
    )
  })
})
