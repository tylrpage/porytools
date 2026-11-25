// What the viewer shows for each action of the line: the log entry, its timeline markers,
// and what it did to the board.
import type { CardDb } from '../cards/db.ts'
import {
  childrenOf,
  Describer,
  focusOf,
  turnLabel,
  turnPlayer,
  type CardLookup,
  type CardRef,
  type Focus,
  type Part,
} from '../game/replay.ts'
import type { GameRecord, State } from '../game/solver.ts'
import type { Flag } from '../game/types/Flag'

export interface Flagged {
  text: Part[]
  flag?: Flag
  /** With `guessed`: the other candidates. */
  alternatives: CardRef[]
}

export interface LogStep extends Flagged {
  node: number
  /** The player who acted, if the action has one. */
  actor: number | null
  changes: Flagged[]
  /** The card for the thumbnail. */
  main: CardRef | null
  /** Global turn number after the action (0: setup). */
  turn: number
  /** "Your turn 2". */
  turnText: string
  /** Whose turn it is (null during setup). */
  turnOwner: number | null
  focus: Focus
  /** For a Knock Out: whose Pokémon it was, and "Psyduck Knocked Out". */
  ko?: { owner: number; text: string }
  /** Other children of this node's parent: branches off the line shown, or back to it. */
  branches: { node: number; label: string }[]
}

export function cardLookup(db: CardDb): CardLookup {
  return {
    attackName: (print, position) => {
      const card = db.cardOfPrint(print)
      return card?.kind === 'pokemon' ? card.attacks[position]?.name : undefined
    },
    abilityName: (print) => {
      const card = db.cardOfPrint(print)
      return card?.kind === 'pokemon' ? card.abilities[0]?.name : undefined
    },
  }
}

/** `states[k]` is the state after the first k nodes of `line` (`states[0]`: the start). */
export function buildSteps(
  db: CardDb,
  record: GameRecord,
  line: number[],
  states: State[],
): LogStep[] {
  const lookup = cardLookup(db)
  const steps: LogStep[] = []
  for (let k = 1; k < states.length; k++) {
    const node = line[k - 1]
    const action = record.nodes[node].action
    const before = states[k - 1]
    const after = states[k]
    const d = new Describer(record.viewpoint, before, after, lookup)
    const parent = k === 1 ? null : line[k - 2]
    const siblings = childrenOf(record, parent)
    const turnOwner =
      after.turn === 0 || after.firstPlayer === null
        ? null
        : turnPlayer(after.turn, after.firstPlayer)
    let ko: LogStep['ko']
    if (action.type === 'knockOut') {
      const mon = d.pokemon(action.pokemon)
      const name = mon.print ? (db.cardOfPrint(mon.print)?.name ?? 'Pokémon') : 'Pokémon'
      ko = { owner: mon.owner ?? 0, text: `${name} Knocked Out` }
    }
    steps.push({
      node,
      // These sentences name the player themselves.
      actor: 'player' in action && action.type !== 'chooseFirst' ? action.player : null,
      text: d.action(action),
      flag: action.flag,
      alternatives: d.alternatives(action.alternatives),
      changes: action.changes.map((c) => ({
        text: d.change(c),
        flag: c.flag,
        alternatives: d.alternatives(c.alternatives),
      })),
      main: d.mainCard(action),
      turn: after.turn,
      turnText: turnLabel(after.turn, after.firstPlayer, record.viewpoint),
      turnOwner,
      focus: focusOf(action, before, after),
      ko,
      branches: siblings
        .filter((n) => n !== node)
        .map((n) => ({
          node: n,
          label: n === siblings[0] ? 'Back to the main line' : (record.nodes[n].label ?? 'Branch'),
        })),
    })
  }
  return steps
}

/** A run of positions in the same turn, for the timeline. Positions are 0..steps.length. */
export interface TurnSpan {
  from: number
  to: number
  turn: number
  owner: number | null
  text: string
}

export function turnSpans(steps: LogStep[]): TurnSpan[] {
  const spans: TurnSpan[] = [{ from: 0, to: 0, turn: 0, owner: null, text: 'Setup' }]
  steps.forEach((s, i) => {
    const last = spans[spans.length - 1]
    if (s.turn === last.turn) last.to = i + 1
    else spans.push({ from: i + 1, to: i + 1, turn: s.turn, owner: s.turnOwner, text: s.turnText })
  })
  return spans
}

/** A description as plain text, for aria labels. */
export function partsText(db: CardDb, parts: Part[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : cardName(db, p.print))).join('')
}

export function cardName(db: CardDb, print: string | null): string {
  if (print === null) return 'unknown card'
  return db.cardOfPrint(print)?.name ?? db.printLabel(print)
}
