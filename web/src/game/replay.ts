// Helpers for the replay viewer: walking the record's tree, naming players and turns, and
// describing actions and changes as text. Card names stay as references (`CardRef`) so the
// page can render them with `CardName`.
import type { Action } from './types/Action'
import type { Alternative } from './types/Alternative'
import type { Change } from './types/Change'
import type { Loc } from './types/Loc'
import type { NewCard } from './types/NewCard'
import type { Pokemon } from './types/Pokemon'
import type { Record as GameRecord } from './types/Record'
import type { State } from './types/State'
import type { Viewer } from './types/Viewer'

/** The node a node hangs from: `null` is the start. */
export function parentOf(record: GameRecord, node: number): number | null {
  const parent = record.nodes[node].parent
  if (parent === undefined) return node === 0 ? null : node - 1
  return parent
}

/** The children of a node (`null`: the start), in record order. The first is the main line. */
export function childrenOf(record: GameRecord, node: number | null): number[] {
  const children: number[] = []
  for (let i = 0; i < record.nodes.length; i++) if (parentOf(record, i) === node) children.push(i)
  return children
}

/**
 * The line through `node`: the path from the start to it, then on along first children to a
 * leaf. Without `node`, the main line.
 */
export function lineThrough(record: GameRecord, node?: number): number[] {
  const line: number[] = []
  let at: number | null = node ?? null
  while (at !== null) {
    line.unshift(at)
    at = parentOf(record, at)
  }
  let tip = line.length ? line[line.length - 1] : null
  for (;;) {
    const next = childrenOf(record, tip)[0]
    if (next === undefined) return line
    line.push(next)
    tip = next
  }
}

/** "You" / "Opponent" for a player record, "Player 1" / "Player 2" for an all-seeing one. */
export function playerName(viewpoint: Viewer, player: number): string {
  if (viewpoint === 'all') return `Player ${player + 1}`
  return viewpoint === player ? 'You' : 'Opponent'
}

const possessive = (name: string) => (name === 'You' ? 'Your' : `${name}'s`)
/** The same, mid-sentence. */
const whose = (name: string) => (name === 'You' ? 'your' : `${name}'s`)

/** Whose turn a global turn number is (turn 1 is the first player's). */
export function turnPlayer(turn: number, firstPlayer: number): number {
  return turn % 2 === 1 ? firstPlayer : 1 - firstPlayer
}

/** "Setup", or the player's own count: "Your turn 2", "Player 1's turn 1". */
export function turnLabel(turn: number, firstPlayer: number | null, viewpoint: Viewer): string {
  if (turn === 0 || firstPlayer === null) return 'Setup'
  const who = playerName(viewpoint, turnPlayer(turn, firstPlayer))
  return `${possessive(who)} turn ${Math.ceil(turn / 2)}`
}

/** A card in a description: an instance, with its print when the viewer knows it. */
export interface CardRef {
  id: number | null
  print: string | null
  /** Whose card it is, when known. */
  owner?: number
}
export type Part = string | CardRef

/** Card data the descriptions need: attack and Ability names by print. */
export interface CardLookup {
  attackName(print: string, position: number): string | undefined
  abilityName(print: string): string | undefined
}

/** The Pokémon in play that has `id` in its stack (any card of it names the Pokémon). */
export function findPokemon(state: State, id: number): Pokemon | undefined {
  for (const p of state.players) {
    for (const mon of [p.active, ...p.bench]) if (mon?.stack.includes(id)) return mon
  }
  return undefined
}

/** Describes one step, given the states just before and after it. */
export class Describer {
  private readonly viewpoint: Viewer
  private readonly before: State
  private readonly after: State
  private readonly lookup: CardLookup

  constructor(viewpoint: Viewer, before: State, after: State, lookup: CardLookup) {
    this.viewpoint = viewpoint
    this.before = before
    this.after = after
    this.lookup = lookup
  }

  private print(id: number): string | null {
    return this.after.cards[id]?.card ?? this.before.cards[id]?.card ?? null
  }

  card = (id: number): CardRef => ({ id, print: this.print(id), owner: this.owner(id) })

  /** The Pokémon `id` belongs to, named by its top card (as it was before the step). */
  pokemon = (id: number): CardRef => {
    const mon = findPokemon(this.before, id) ?? findPokemon(this.after, id)
    return this.card(mon ? mon.stack[mon.stack.length - 1] : id)
  }

  private player = (p: number) => playerName(this.viewpoint, p)

  private list(refs: CardRef[]): Part[] {
    const known = refs.filter((r) => r.print !== null)
    const unknown = refs.length - known.length
    const parts: Part[] = []
    known.forEach((r, i) => {
      if (i > 0) parts.push(', ')
      parts.push(r)
    })
    if (unknown > 0) {
      if (known.length) parts.push(', ')
      parts.push(unknown === 1 ? '1 unknown card' : `${unknown} unknown cards`)
    }
    return parts
  }

  private newCards = (cards: NewCard[]) =>
    this.list(cards.map((c) => ({ id: c.id, print: c.card ?? null })))

  private loc(loc: Loc, owner?: number): Part[] {
    const of =
      loc.player !== undefined && loc.player !== owner ? `${whose(this.player(loc.player))} ` : ''
    switch (loc.zone) {
      case 'hand':
        return [`${of}hand`]
      case 'deck':
        return [`${of}deck`]
      case 'deckTop':
        return [`top of ${of}deck`]
      case 'deckBottom':
        return [`bottom of ${of}deck`]
      case 'active':
        return [`${of}Active Spot`]
      case 'bench':
        return [`${of}Bench`]
      case 'discard':
        return [`${of}discard pile`]
      case 'prizes':
        return [`${of}Prizes`]
      case 'lostZone':
        return [`${of}Lost Zone`]
      case 'stadium':
        return ['Stadium']
      case 'pending':
        return ['in play (pending)']
      case 'stack':
        return ['onto ', this.pokemon(loc.on)]
      case 'attached':
        return ['attached to ', this.pokemon(loc.on)]
    }
  }

  private owner(id: number): number | undefined {
    return this.after.cards[id]?.owner ?? this.before.cards[id]?.owner
  }

  /** The action as a sentence. Its `flag` isn't included: the page shows it as a tag. */
  action(a: Action): Part[] {
    const P = this.player
    switch (a.type) {
      case 'openingCoinFlip':
        return [`${P(a.caller)} called ${a.call}; ${P(a.winner)} won the coin flip`]
      case 'chooseFirst':
        return [`${P(a.player)} chose to go ${a.first === a.player ? 'first' : 'second'}`]
      case 'openingHand':
        return ['Draw the opening hand']
      case 'mulligan':
        return ['Mulligan']
      case 'placeStart':
        return ['Place starting Pokémon face down']
      case 'setPrizes':
        return ['Set out Prize cards']
      case 'mulliganDraws':
        return [`Draw ${a.count} for the opponent's mulligans`]
      case 'revealStart':
        return ['Reveal starting Pokémon']
      case 'startTurn':
        return ['Start turn']
      case 'playCard':
        return ['Play ', this.card(a.card)]
      case 'playBasic':
        return ['Bench ', this.card(a.card)]
      case 'evolve':
        return ['Evolve ', this.pokemon(a.onto), ' into ', this.card(a.card)]
      case 'attachEnergy':
        return ['Attach ', this.card(a.card), ' to ', this.pokemon(a.onto)]
      case 'retreat':
        return ['Retreat ', this.pokemon(a.pokemon), '; ', this.pokemon(a.to), ' goes Active']
      case 'useAbility': {
        const mon = this.pokemon(a.pokemon)
        const name = mon.print && this.lookup.abilityName(mon.print)
        return ['Use ', mon, `'s Ability${name ? `: ${name}` : ''}`]
      }
      case 'trigger':
        return [this.card(a.card), ' triggers']
      case 'attack': {
        const mon = this.pokemon(a.pokemon)
        const source = a.from !== undefined ? this.card(a.from) : mon
        const name = source.print && this.lookup.attackName(source.print, a.attack)
        return [mon, ` attacks: ${name ?? `attack ${a.attack + 1}`}`]
      }
      case 'checkup':
        return ['Pokémon Checkup']
      case 'knockOut':
        return [this.pokemon(a.pokemon), ' is Knocked Out']
      case 'takePrizes':
        return [`Take ${a.count} Prize card${a.count === 1 ? '' : 's'}`]
      case 'promote':
        return ['Promote ', this.pokemon(a.pokemon), ' to the Active Spot']
      case 'endTurn':
        return ['End turn']
      case 'endGame': {
        const reason = END_REASONS[a.reason]
        if (a.winner === null) return [`Game over: a tie (${reason})`]
        const who = P(a.winner)
        return [`Game over: ${who} ${who === 'You' ? 'win' : 'wins'} (${reason})`]
      }
    }
  }

  /** The action's main card, for its thumbnail: what was played, or the Pokémon that acted. */
  mainCard(a: Action): CardRef | null {
    switch (a.type) {
      case 'playCard':
      case 'playBasic':
      case 'evolve':
      case 'attachEnergy':
      case 'trigger':
        return this.card(a.card)
      case 'useAbility':
      case 'attack':
      case 'knockOut':
      case 'promote':
      case 'retreat':
        return this.pokemon(a.pokemon)
      default:
        return null
    }
  }

  /** "Guessed" alternatives as card references (instance IDs or prints). */
  alternatives(alts: Alternative[] | undefined): CardRef[] {
    return (alts ?? []).map((a) => (typeof a === 'number' ? this.card(a) : { id: null, print: a }))
  }

  /** A change as a sentence, without its `flag` (shown as a tag). */
  change(c: Change): Part[] {
    const P = this.player
    switch (c.type) {
      case 'draw':
        return [
          `${P(c.player)} ${c.player === this.viewpoint ? 'draw' : 'draws'}: `,
          ...this.newCards(c.cards),
        ]
      case 'fromDeck':
        return ['From the deck to ', ...this.loc(c.to, c.player), ': ', ...this.newCards(c.cards)]
      case 'move': {
        const owner = this.owner(c.cards[0])
        return [...this.list(c.cards.map(this.card)), ' → ', ...this.loc(c.to, owner)]
      }
      case 'toDeck': {
        const where = {
          pool: 'into the deck',
          top: 'on top of the deck',
          bottom: 'on the bottom of the deck',
        }
        return [...this.list(c.cards.map(this.card)), ` ${where[c.pos]}`]
      }
      case 'shuffle':
        return [`Shuffle ${whose(P(c.player))} deck`]
      case 'reveal': {
        const refs = Object.entries(c.cards).map(([id, print]) => ({ id: Number(id), print }))
        const to = c.to === 'all' ? 'everyone' : c.to === this.viewpoint ? 'you' : P(c.to)
        return [`Reveal to ${to}: `, ...this.list(refs)]
      }
      case 'lookAtDeck':
        return [`Look at ${whose(P(c.player))} deck`]
      case 'switch':
        return ['Switch: ', this.pokemon(c.bench), ' goes Active']
      case 'damage':
        return [this.pokemon(c.pokemon), ` takes ${c.amount} damage`]
      case 'counters':
        return [`${c.count} damage counter${c.count === 1 ? '' : 's'} on `, this.pokemon(c.pokemon)]
      case 'heal':
        return ['Heal ', `${c.amount} damage from `, this.pokemon(c.pokemon)]
      case 'condition': {
        const parts: Part[] = [this.pokemon(c.pokemon)]
        if (c.add) parts.push(` is now ${CONDITIONS[c.add]}`)
        if (c.add && c.remove) parts.push(' and')
        if (c.remove) parts.push(` is no longer ${CONDITIONS[c.remove]}`)
        return parts
      }
      case 'coinFlip':
        return [`Coin flip: ${c.result}`]
      case 'choose':
        return [`Choose ${c.what}: ${c.value}`]
    }
  }
}

export const CONDITIONS = {
  asleep: 'Asleep',
  confused: 'Confused',
  paralyzed: 'Paralyzed',
  poisoned: 'Poisoned',
  burned: 'Burned',
} as const

const END_REASONS = {
  prizes: 'all Prize cards taken',
  noPokemon: 'no Pokémon left in play',
  deckOut: 'deck out',
  concede: 'concede',
  other: 'other',
} as const

/** What an action did to the table, for highlighting it on the board. */
export interface Focus {
  /** Cards the action moved or changed. A Pokémon counts when any card of it is here. */
  touched: Set<number>
  /** Players whose deck changed without a tracked card (cards put back, a shuffle). */
  decks: Set<number>
  /**
   * Cards only looked at or revealed: they end up where they started (a revealed card that
   * stays in hand, cards looked at and put back). `id` is null for a look at the whole deck.
   */
  seen: { id: number | null; print: string; count: number }[]
}

/** Where a card is, coarsely: a player's zone, the Stadium, or the deck when untracked. */
function zoneOf(state: State, id: number): string {
  const owner = state.cards[id]?.owner
  if (owner === undefined) return 'deck'
  if (state.stadium.includes(id)) return 'stadium'
  const p = state.players[owner]
  if (p.hand.includes(id)) return `${owner}hand`
  if (p.deck.top.includes(id) || p.deck.bottom.includes(id)) return `${owner}deck`
  if (p.prizes.includes(id)) return `${owner}prizes`
  if (p.discard.includes(id)) return `${owner}discard`
  if (p.lostZone.includes(id)) return `${owner}lost`
  if (p.pending.includes(id)) return `${owner}pending`
  for (const mon of [p.active, ...p.bench]) {
    if (mon?.stack.includes(id) || mon?.attached.includes(id)) return `${owner}play${mon.stack[0]}`
  }
  return 'deck'
}

export function focusOf(a: Action, before: State, after: State): Focus {
  const touched = new Set<number>()
  const decks = new Set<number>()
  const looked = new Map<number, string>()
  const seen: Focus['seen'] = []
  const add = (...ids: (number | undefined)[]) => {
    for (const id of ids) if (id !== undefined) touched.add(id)
  }
  if ('card' in a) add(a.card)
  if ('onto' in a) add(a.onto)
  if ('pokemon' in a) add(a.pokemon)
  if ('to' in a) add(a.to)
  if ('from' in a) add(a.from)
  for (const c of a.changes) {
    switch (c.type) {
      case 'draw':
      case 'fromDeck':
        for (const n of c.cards) {
          add(n.id)
          if (n.card) looked.set(n.id, n.card)
        }
        break
      case 'move':
        add(...c.cards)
        break
      case 'toDeck':
        add(...c.cards)
        for (const id of c.cards) {
          const owner = before.cards[id]?.owner ?? after.cards[id]?.owner
          if (owner !== undefined) decks.add(owner)
        }
        break
      case 'shuffle':
        decks.add(c.player)
        break
      case 'reveal':
        for (const [id, print] of Object.entries(c.cards)) looked.set(Number(id), print)
        break
      case 'lookAtDeck':
        for (const [print, count] of c.contents) seen.push({ id: null, print, count })
        break
      case 'switch': {
        add(c.bench)
        const was = before.players[c.player].active
        if (was) add(was.stack[0])
        break
      }
      case 'damage':
      case 'counters':
      case 'heal':
      case 'condition':
        add(c.pokemon)
        break
    }
  }
  // Drawn cards that stayed in the deck were only looked at; so were revealed cards that
  // didn't move. Cards that moved show where they went instead.
  const stayed = [...looked]
    .filter(([id]) => zoneOf(before, id) === zoneOf(after, id))
    .map(([id, print]) => ({ id, print, count: 1 }))
  // Those still on the table are highlighted there too.
  for (const s of stayed) if (zoneOf(after, s.id) !== 'deck') touched.add(s.id)
  return { touched, decks, seen: [...stayed, ...seen] }
}
