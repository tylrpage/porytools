// Helpers for the replay viewer: walking the record's tree, naming players and turns, and
// describing actions and changes as text. Card names stay as references (`CardRef`) so the
// page can render them with `CardName`.
import type { Action } from './types/Action'
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

  card = (id: number): CardRef => ({ id, print: this.print(id) })

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

  action(a: Action): Part[] {
    const parts = this.actionParts(a)
    if (a.flag) parts.push(` (${a.flag})`)
    return parts
  }

  private actionParts(a: Action): Part[] {
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

  /** Who acted, for actions that have a player. */
  actor(a: Action): string | null {
    if ('player' in a) return this.player(a.player)
    return null
  }

  change(c: Change): Part[] {
    const parts = this.changeParts(c)
    if (c.flag) parts.push(` (${c.flag})`)
    return parts
  }

  private changeParts(c: Change): Part[] {
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
