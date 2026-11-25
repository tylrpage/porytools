// The replay viewer: load a game record, step through its events, and see the board as text.
// Loaded lazily (App.tsx), so only this page downloads the WASM solver.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CardDb } from '../cards/db.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import CardName from '../components/CardName.tsx'
import {
  childrenOf,
  CONDITIONS,
  Describer,
  lineThrough,
  playerName,
  turnLabel,
  type CardLookup,
  type CardRef,
  type Part,
} from '../game/replay.ts'
import { SAMPLES } from '../game/samples.ts'
import {
  loadSolver,
  type GameRecord,
  type RecordError,
  type Solver,
  type State,
} from '../game/solver.ts'
import type { Pokemon } from '../game/types/Pokemon'
import type { Viewer } from '../game/types/Viewer'

type Loaded =
  { status: 'loading' } | { status: 'ready'; solver: Solver } | { status: 'error'; message: string }

function useSolver(): Loaded {
  const [state, setState] = useState<Loaded>({ status: 'loading' })
  useEffect(() => {
    let live = true
    loadSolver().then(
      (solver) => live && setState({ status: 'ready', solver }),
      (e: unknown) => live && setState({ status: 'error', message: (e as Error).message }),
    )
    return () => {
      live = false
    }
  }, [])
  return state
}

export default function Replay() {
  const cards = useCardDb()
  const solver = useSolver()
  const failed = cards.status === 'error' ? cards : solver.status === 'error' ? solver : null
  return (
    <>
      <h1>Replay</h1>
      <p>
        Step through a game record and see the board after each event. For now it plays a few
        hand-written sample records, or one you paste.
      </p>
      {failed && <p className="problem error">{failed.message}</p>}
      {!failed && (cards.status === 'loading' || solver.status === 'loading') && (
        <p className="muted">Loading…</p>
      )}
      {cards.status === 'ready' && solver.status === 'ready' && (
        <Loader db={cards.db} solver={solver.solver} />
      )}
    </>
  )
}

type Parsed = { record: GameRecord; errors: RecordError[] } | { error: string }

function parseRecord(text: string, solver: Solver): Parsed {
  try {
    const record = JSON.parse(text) as GameRecord
    return { record, errors: solver.check(record) }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

function Loader({ db, solver }: { db: CardDb; solver: Solver }) {
  const [text, setText] = useState(SAMPLES[0].json)
  // Bumped on every load, so the viewer starts over at the beginning.
  const [loads, setLoads] = useState(0)
  const parsed = useMemo(() => parseRecord(text, solver), [text, solver])

  const load = (json: string) => {
    setText(json)
    setLoads((n) => n + 1)
  }

  return (
    <>
      <div className="replay-load">
        {SAMPLES.map((s) => (
          <button key={s.name} type="button" onClick={() => load(s.json)}>
            {s.name}
          </button>
        ))}
      </div>
      <details className="deck-input">
        <summary>Paste a record (JSON)</summary>
        <textarea
          className="decklist-input"
          aria-label="Game record"
          value={text}
          onChange={(e) => load(e.target.value)}
          rows={10}
          spellCheck={false}
        />
      </details>
      {'error' in parsed ? (
        <p className="problem error">Not a game record: {parsed.error}</p>
      ) : (
        <>
          {parsed.errors.length > 0 && (
            <ul className="problems">
              {parsed.errors.map((e, i) => (
                <li key={i} className="problem warning">
                  {e.node !== null && `Event ${e.node + 1}: `}
                  {e.message}
                </li>
              ))}
            </ul>
          )}
          <Viewer key={loads} db={db} solver={solver} record={parsed.record} />
        </>
      )}
    </>
  )
}

function cardLookup(db: CardDb): CardLookup {
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

interface Step {
  node: number
  actor: string | null
  text: Part[]
  changes: Part[][]
  turn: string
  /** Other children of this node: branches off the line being shown (or back to it). */
  branches: { node: number; label: string }[]
}

function Viewer({ db, solver, record }: { db: CardDb; solver: Solver; record: GameRecord }) {
  // All-seeing records can be shown as either player saw them.
  const [view, setView] = useState<Viewer>(record.viewpoint)
  // The line shown runs through `tip` (undefined: the main line); `pos` is how many of its
  // events have happened.
  const [tip, setTip] = useState<number | undefined>(undefined)
  const [pos, setPos] = useState(0)

  const shown = useMemo(
    () => (view === record.viewpoint || view === 'all' ? record : solver.project(record, view)),
    [record, view, solver],
  )
  const line = useMemo(() => lineThrough(shown, tip), [shown, tip])

  // The state before any event, then after each one; stops at the first event that fails.
  const { states, foldError } = useMemo(() => {
    const states: State[] = []
    try {
      states.push(solver.fold({ ...shown, nodes: [] }))
      for (const node of line) states.push(solver.fold(shown, node))
      return { states, foldError: null }
    } catch (e) {
      return { states, foldError: (e as Error).message }
    }
  }, [shown, line, solver])

  const steps = useMemo(() => {
    const lookup = cardLookup(db)
    const steps: Step[] = []
    for (let k = 1; k < states.length; k++) {
      const node = line[k - 1]
      const action = shown.nodes[node].action
      const d = new Describer(shown.viewpoint, states[k - 1], states[k], lookup)
      const parent = k === 1 ? null : line[k - 2]
      const main = childrenOf(shown, parent)[0]
      steps.push({
        node,
        actor: d.actor(action),
        text: d.action(action),
        changes: action.changes.map((c) => d.change(c)),
        turn: turnLabel(states[k].turn, states[k].firstPlayer, shown.viewpoint),
        branches: childrenOf(shown, parent)
          .filter((n) => n !== node)
          .map((n) => ({
            node: n,
            label: n === main ? 'Back to the main line' : (shown.nodes[n].label ?? 'Branch'),
          })),
      })
    }
    return steps
  }, [db, shown, line, states])

  const last = states.length - 1
  const at = Math.min(pos, last)
  const state = states[at]
  const current = at > 0 ? steps[at - 1] : null

  const goTo = (node: number) => {
    setTip(node)
    setPos(lineThrough(shown, node).indexOf(node) + 1)
  }

  // Keep the current event in view in the event list (scrolling the list, not the page).
  const list = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    const box = list.current
    const item = box?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!box || !item) return
    const top = item.offsetTop - box.offsetTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + item.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = top + item.offsetHeight - box.clientHeight
  }, [at, line])

  if (!state) return <p className="problem error">{foldError}</p>

  const players = shown.viewpoint === 'all' ? [0, 1] : [1 - shown.viewpoint, shown.viewpoint]

  return (
    <div className="replay">
      {record.viewpoint === 'all' && (
        <label className="replay-view">
          Seen by{' '}
          <select
            value={String(view)}
            onChange={(e) =>
              setView(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 0 | 1))
            }
          >
            <option value="all">Everyone (all cards known)</option>
            <option value="0">Player 1</option>
            <option value="1">Player 2</option>
          </select>
        </label>
      )}
      <div className="replay-controls">
        <button
          type="button"
          onClick={() => setPos(0)}
          disabled={at === 0}
          aria-label="First event"
        >
          ⏮
        </button>
        <button
          type="button"
          onClick={() => setPos(at - 1)}
          disabled={at === 0}
          aria-label="Previous event"
        >
          ◀
        </button>
        <button
          type="button"
          onClick={() => setPos(at + 1)}
          disabled={at === last}
          aria-label="Next event"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setPos(last)}
          disabled={at === last}
          aria-label="Last event"
        >
          ⏭
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={at}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Event"
        />
        <span className="replay-count">
          {at} / {last}
        </span>
      </div>
      {foldError && (
        <p className="problem error">
          Stops at event {line[states.length - 1] + 1}: {foldError}
        </p>
      )}

      <div className="replay-main">
        <div className="replay-board">
          <p className="replay-turn">
            <strong>{turnLabel(state.turn, state.firstPlayer, shown.viewpoint)}</strong>
            {state.result && (
              <>
                {' · '}
                {state.result.winner === null
                  ? 'Tie'
                  : `${playerName(shown.viewpoint, state.result.winner)} won`}
              </>
            )}
          </p>
          <div className="replay-event" aria-live="polite">
            {current ? (
              <>
                <p>
                  {current.actor && <strong>{current.actor}: </strong>}
                  <Text db={db} parts={current.text} />
                </p>
                {current.changes.length > 0 && (
                  <ul>
                    {current.changes.map((c, i) => (
                      <li key={i}>
                        <Text db={db} parts={c} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="muted">Start of the game: both decks shuffled, nothing drawn yet.</p>
            )}
          </div>
          {state.stadium.length > 0 && (
            <p>
              <strong>Stadium:</strong> <Cards db={db} state={state} ids={state.stadium} />
            </p>
          )}
          {players.map((p) => (
            <PlayerBoard
              key={p}
              db={db}
              state={state}
              player={p}
              name={playerName(shown.viewpoint, p)}
            />
          ))}
        </div>

        <section className="replay-log" aria-label="Events">
          <h2>Events</h2>
          <ol ref={list}>
            <li>
              <button
                type="button"
                aria-current={at === 0 ? 'step' : undefined}
                onClick={() => setPos(0)}
              >
                Start
              </button>
            </li>
            {steps.map((s, i) => (
              <li key={s.node}>
                {(i === 0 || steps[i - 1].turn !== s.turn) && <h3>{s.turn}</h3>}
                {s.branches.map((b) => (
                  <button
                    key={b.node}
                    type="button"
                    className="replay-branch"
                    onClick={() => goTo(b.node)}
                  >
                    ↳ {b.label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-current={at === i + 1 ? 'step' : undefined}
                  onClick={() => setPos(i + 1)}
                >
                  {s.actor && <span className="muted">{s.actor}: </span>}
                  <Text db={db} parts={s.text} plain />
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

/**
 * A description. Card names show the card on hover, except `plain` ones (inside a button,
 * where a nested button isn't allowed).
 */
function Text({ db, parts, plain = false }: { db: CardDb; parts: Part[]; plain?: boolean }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? p : <Ref key={i} db={db} card={p} plain={plain} />,
      )}
    </>
  )
}

function Ref({ db, card, plain = false }: { db: CardDb; card: CardRef; plain?: boolean }) {
  if (card.print === null) return <span className="muted">unknown card</span>
  const data = db.cardOfPrint(card.print)
  if (!data) return <>{db.printLabel(card.print)}</>
  return plain ? <>{data.name}</> : <CardName card={data} />
}

/** Cards as a list, same cards counted together ("Psychic Energy ×3"), unknown ones last. */
function Cards({ db, state, ids }: { db: CardDb; state: State; ids: number[] }) {
  if (ids.length === 0) return <span className="muted">none</span>
  const counts = new Map<string, number>()
  let unknown = 0
  for (const id of ids) {
    const print = state.cards[id]?.card
    if (print) counts.set(print, (counts.get(print) ?? 0) + 1)
    else unknown++
  }
  const parts: ReactNode[] = []
  for (const [print, n] of counts) {
    if (parts.length) parts.push(', ')
    parts.push(
      <span key={print}>
        <Ref db={db} card={{ id: null, print }} />
        {n > 1 && ` ×${n}`}
      </span>,
    )
  }
  if (unknown) {
    if (parts.length) parts.push(', ')
    parts.push(
      <span key="unknown" className="muted">
        {unknown} unknown
      </span>,
    )
  }
  return <>{parts}</>
}

function PokemonLine({ db, state, mon }: { db: CardDb; state: State; mon: Pokemon }) {
  const top = mon.stack[mon.stack.length - 1]
  const print = state.cards[top]?.card ?? null
  const card = print ? db.cardOfPrint(print) : undefined
  const hp = card?.kind === 'pokemon' ? card.hp : null
  const conditions = [
    mon.conditions.rotation,
    mon.conditions.poisoned && 'poisoned',
    mon.conditions.burned && 'burned',
  ]
    .filter((c) => !!c)
    .map((c) => CONDITIONS[c as keyof typeof CONDITIONS])
  const facts: string[] = []
  if (mon.faceDown) facts.push('face down')
  if (hp !== null) facts.push(`${hp - mon.counters * 10}/${hp} HP`)
  else if (mon.counters) facts.push(`${mon.counters * 10} damage`)
  facts.push(...conditions)
  return (
    <>
      <Ref db={db} card={{ id: top, print }} />
      {facts.length > 0 && <span className="muted"> · {facts.join(' · ')}</span>}
      {mon.stack.length > 1 && (
        <span className="muted">
          {' '}
          · evolved from <Cards db={db} state={state} ids={mon.stack.slice(0, -1)} />
        </span>
      )}
      {mon.attached.length > 0 && (
        <div className="replay-attached">
          Attached: <Cards db={db} state={state} ids={mon.attached} />
        </div>
      )}
    </>
  )
}

function PlayerBoard({
  db,
  state,
  player,
  name,
}: {
  db: CardDb
  state: State
  player: number
  name: string
}) {
  const p = state.players[player]
  const deckKnown = [...p.deck.top, ...p.deck.bottom]
  const deckCount = p.deck.count + deckKnown.length
  return (
    <section className="replay-player" aria-label={name}>
      <h2>{name}</h2>
      <dl>
        <dt>Active</dt>
        <dd>
          {p.active ? (
            <PokemonLine db={db} state={state} mon={p.active} />
          ) : (
            <span className="muted">none</span>
          )}
        </dd>
        <dt>Bench ({p.bench.length})</dt>
        <dd>
          {p.bench.length === 0 ? (
            <span className="muted">none</span>
          ) : (
            <ul>
              {p.bench.map((mon) => (
                <li key={mon.stack[0]}>
                  <PokemonLine db={db} state={state} mon={mon} />
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt>Hand ({p.hand.length})</dt>
        <dd>
          <Cards db={db} state={state} ids={p.hand} />
        </dd>
        <dt>Deck ({deckCount})</dt>
        <dd>
          {p.deck.top.length > 0 && (
            <div>
              Top: <Cards db={db} state={state} ids={p.deck.top} />
            </div>
          )}
          {p.deck.bottom.length > 0 && (
            <div>
              Bottom: <Cards db={db} state={state} ids={p.deck.bottom} />
            </div>
          )}
          {deckKnown.length === 0 && (
            <span className="muted">{deckCount === 0 ? 'empty' : 'order unknown'}</span>
          )}
        </dd>
        <dt>Prizes ({p.prizes.length})</dt>
        <dd>
          <Cards db={db} state={state} ids={p.prizes} />
        </dd>
        <dt>Discard ({p.discard.length})</dt>
        <dd>
          <Cards db={db} state={state} ids={p.discard} />
        </dd>
        {p.lostZone.length > 0 && (
          <>
            <dt>Lost Zone ({p.lostZone.length})</dt>
            <dd>
              <Cards db={db} state={state} ids={p.lostZone} />
            </dd>
          </>
        )}
        {p.pending.length > 0 && (
          <>
            <dt>Being played</dt>
            <dd>
              <Cards db={db} state={state} ids={p.pending} />
            </dd>
          </>
        )}
        {p.mulligans > 0 && (
          <>
            <dt>Mulligans</dt>
            <dd>{p.mulligans}</dd>
          </>
        )}
      </dl>
    </section>
  )
}
