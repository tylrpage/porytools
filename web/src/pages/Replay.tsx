// The replay viewer: load a game record and step through it on a picture of the table, with
// the log beside or behind it and a timeline. Design: docs/replay-viewer.md. Loaded lazily
// (App.tsx), so only this page downloads the WASM solver.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import type { CardDb } from '../cards/db.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import { lineThrough, playerName } from '../game/replay.ts'
import { SAMPLES } from '../game/samples.ts'
import {
  loadSolver,
  type GameRecord,
  type RecordError,
  type Solver,
  type State,
} from '../game/solver.ts'
import type { Viewer as Seen } from '../game/types/Viewer'
import Board from '../replay/Board.tsx'
import CardFace from '../replay/CardFace.tsx'
import {
  useViewer,
  ViewerContext,
  type Shown,
  type Side,
  type Viewer as ViewerValue,
} from '../replay/context.ts'
import Dialog from '../replay/Dialog.tsx'
import Log from '../replay/Log.tsx'
import ShownDialog from '../replay/ShownDialog.tsx'
import { buildSteps, cardName, turnSpans, type LogStep } from '../replay/steps.ts'
import { FlagTag, Player, Text } from '../replay/Text.tsx'
import Timeline from '../replay/Timeline.tsx'
import { useLatest, useWide } from '../replay/hooks.ts'
import '../replay/replay.css'

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
    <div className="replay-page">
      <h1 className="visually-hidden">Replay</h1>
      {failed && <p className="problem error">{failed.message}</p>}
      {!failed && (cards.status === 'loading' || solver.status === 'loading') && (
        <p className="muted">Loading…</p>
      )}
      {cards.status === 'ready' && solver.status === 'ready' && (
        <Loader db={cards.db} solver={solver.solver} />
      )}
    </div>
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
  const [pasting, setPasting] = useState(false)
  const parsed = useMemo(() => parseRecord(text, solver), [text, solver])

  const load = (json: string) => {
    setText(json)
    setLoads((n) => n + 1)
  }

  const tools = (
    <>
      {SAMPLES.map((s) => (
        <button key={s.name} type="button" onClick={() => load(s.json)}>
          {s.name}
        </button>
      ))}
      <button type="button" onClick={() => setPasting(true)}>
        Paste a record
      </button>
      {'errors' in parsed && parsed.errors.length > 0 && <Problems errors={parsed.errors} />}
    </>
  )

  return (
    <>
      {'error' in parsed ? (
        <>
          <div className="replay-toolbar">{tools}</div>
          <p className="problem error">Not a game record: {parsed.error}</p>
        </>
      ) : (
        <Viewer key={loads} db={db} solver={solver} record={parsed.record} tools={tools} />
      )}
      {pasting && (
        <PasteDialog
          text={text}
          solver={solver}
          onLoad={(json) => {
            load(json)
            setPasting(false)
          }}
          onClose={() => setPasting(false)}
        />
      )}
    </>
  )
}

function PasteDialog({
  text,
  solver,
  onLoad,
  onClose,
}: {
  text: string
  solver: Solver
  onLoad: (json: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(text)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog label="Paste a record" className="paste" onClose={onClose}>
      <h2>Paste a record</h2>
      <p className="muted small">A game record as JSON (docs/game-format.md).</p>
      <textarea
        className="decklist-input"
        aria-label="Game record"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        rows={12}
        spellCheck={false}
      />
      {error && <p className="problem error">Not a game record: {error}</p>}
      <div className="paste-actions">
        <button
          type="button"
          onClick={() => {
            const p = parseRecord(draft, solver)
            if ('error' in p) setError(p.error)
            else onLoad(draft)
          }}
        >
          Load
        </button>
      </div>
    </Dialog>
  )
}

/** `check` problems as a warning count that opens into the list. */
function Problems({ errors }: { errors: RecordError[] }) {
  return (
    <details className="replay-problems">
      <summary className="problem warning">
        ⚠ {errors.length} problem{errors.length === 1 ? '' : 's'}
      </summary>
      <ul className="problems">
        {errors.map((e, i) => (
          <li key={i} className="problem warning">
            {e.node !== null && `Action ${e.node + 1}: `}
            {e.message}
          </li>
        ))}
      </ul>
    </details>
  )
}

function Viewer({
  db,
  solver,
  record,
  tools,
}: {
  db: CardDb
  solver: Solver
  record: GameRecord
  tools: ReactNode
}) {
  const wide = useWide()
  // All-seeing records can be shown as either player saw them.
  const [view, setView] = useState<Seen>(record.viewpoint)
  // The line shown runs through `tip` (undefined: the main line); `pos` is how many of its
  // actions have happened.
  const [tip, setTip] = useState<number | undefined>(undefined)
  const [pos, setPos] = useState(0)
  const [shownStack, setShownStack] = useState<Shown[]>([])
  const [logOpen, setLogOpen] = useState(false)

  const shown = useMemo(
    () => (view === record.viewpoint || view === 'all' ? record : solver.project(record, view)),
    [record, view, solver],
  )
  const line = useMemo(() => lineThrough(shown, tip), [shown, tip])

  // The state before any action, then after each one; stops at the first action that fails.
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

  const steps = useMemo(() => buildSteps(db, shown, line, states), [db, shown, line, states])
  const spans = useMemo(() => turnSpans(steps), [steps])

  const last = states.length - 1
  const at = Math.max(0, Math.min(pos, last))
  const state = states[at] as State | undefined
  const current = at > 0 ? steps[at - 1] : null
  // The bottom player: the record's viewpoint, or Player 1 for an all-seeing one.
  const bottom = shown.viewpoint === 'all' ? 0 : shown.viewpoint

  const goToNode = (node: number) => {
    setTip(node)
    setPos(lineThrough(shown, node).indexOf(node) + 1)
  }

  const spanIndex = spans.findIndex((s) => at >= s.from && at <= s.to)
  const prevTurn = () => {
    const s = spans[spanIndex]
    setPos(at > s.from || spanIndex === 0 ? s.from : spans[spanIndex - 1].from)
  }
  const nextTurn = () => setPos(spans[spanIndex + 1]?.from ?? last)

  const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
    const key = e.key
    if (key === 'ArrowLeft') (e.shiftKey ? prevTurn : () => setPos(at - 1))()
    else if (key === 'ArrowRight') (e.shiftKey ? nextTurn : () => setPos(at + 1))()
    else if (key === 'Home') setPos(0)
    else if (key === 'End') setPos(last)
    else return
    e.preventDefault()
  }
  const onKeyRef = useLatest(onKey)
  // The same keys anywhere on the page, except while typing or in a dialog.
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, select, dialog')) return
      onKeyRef.current(e)
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [onKeyRef])

  const side = useCallback((p: number): Side => (p === bottom ? 'a' : 'b'), [bottom])
  const name = useCallback((p: number) => playerName(shown.viewpoint, p), [shown.viewpoint])
  const show = useCallback((s: Shown) => setShownStack((st) => [...st, s]), [])
  const ctx: ViewerValue | null = state
    ? { db, state, focus: current?.focus ?? null, side, name, show }
    : null

  const viewMenu = record.viewpoint === 'all' && (
    <label className="replay-view">
      Viewpoint{' '}
      <select
        value={String(view)}
        onChange={(e) =>
          setView(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 0 | 1))
        }
      >
        <option value="all">Everyone</option>
        <option value="0">Player 1</option>
        <option value="1">Player 2</option>
      </select>
    </label>
  )

  if (!state || !ctx)
    return (
      <>
        <div className="replay-toolbar">{tools}</div>
        <p className="problem error">{foldError}</p>
      </>
    )

  const turnText = current?.turnText ?? 'Setup'
  const positionText =
    at === 0 ? `Start, of ${last} actions` : `Action ${at} of ${last}, ${turnText}`
  const result =
    state.result && (state.result.winner === null ? 'Tie' : `${name(state.result.winner)} won`)

  const log = <Log steps={steps} at={at} onJump={setPos} onBranch={goToNode} />

  return (
    <ViewerContext.Provider value={ctx}>
      <div className="replay-toolbar">
        {tools}
        {viewMenu}
      </div>
      {foldError && (
        <p className="problem error">
          Stops at action {line[states.length - 1] + 1}: {foldError}
        </p>
      )}
      <div className={wide ? 'replay-body horizontal' : 'replay-body vertical'}>
        <div className="replay-stage">
          <Board bottom={bottom} caption={<Caption step={current} />} />
          <div className="replay-controls">
            <Timeline
              steps={steps}
              spans={spans}
              at={at}
              label={positionText}
              onSeek={setPos}
              onKey={onKey}
            />
            <div className="replay-buttons">
              <button
                type="button"
                onClick={() => setPos(0)}
                disabled={at === 0}
                aria-label="First action"
              >
                ⏮
              </button>
              <button
                type="button"
                onClick={prevTurn}
                disabled={at === 0}
                aria-label="Previous turn"
              >
                ⏪
              </button>
              <button
                type="button"
                onClick={() => setPos(at - 1)}
                disabled={at === 0}
                aria-label="Previous action"
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() => setPos(at + 1)}
                disabled={at === last}
                aria-label="Next action"
              >
                ▶
              </button>
              <button
                type="button"
                onClick={nextTurn}
                disabled={at === last}
                aria-label="Next turn"
              >
                ⏩
              </button>
              <button
                type="button"
                onClick={() => setPos(last)}
                disabled={at === last}
                aria-label="Last action"
              >
                ⏭
              </button>
              <span className="replay-position">
                <strong>{turnText}</strong>
                {result && ` · ${result}`}
                <span className="muted">
                  {' '}
                  · {at}/{last}
                </span>
              </span>
              {!wide && (
                <button type="button" className="log-button" onClick={() => setLogOpen(true)}>
                  Log
                </button>
              )}
            </div>
          </div>
        </div>
        {wide && (
          <section className="replay-log" aria-label="Log">
            {log}
          </section>
        )}
      </div>
      {!wide && logOpen && (
        <Dialog label="Log" className="log-sheet" onClose={() => setLogOpen(false)}>
          <h2>Log</h2>
          <Log
            steps={steps}
            at={at}
            onJump={(p) => {
              setPos(p)
              setLogOpen(false)
            }}
            onBranch={goToNode}
          />
        </Dialog>
      )}
      {shownStack.map((s, i) => (
        <ShownDialog key={i} shown={s} onClose={() => setShownStack((st) => st.slice(0, i))} />
      ))}
    </ViewerContext.Provider>
  )
}

/** The current action over the Stadium line, with any cards it only looked at or revealed. */
function Caption({ step }: { step: LogStep | null }) {
  const { db, show, focus } = useViewer()
  if (!step) return <p className="caption-line muted">Start of the game: both decks shuffled.</p>
  return (
    <>
      <p className="caption-line">
        {step.actor !== null && (
          <>
            <Player player={step.actor} />:{' '}
          </>
        )}
        <Text parts={step.text} /> <FlagTag flag={step.flag} alternatives={step.alternatives} />
      </p>
      {step.focus.seen.length > 0 && (
        <ul className="seen-strip" aria-label="Looked at or revealed">
          {step.focus.seen.map((s, i) => {
            const onBoard = s.id !== null && focus?.touched.has(s.id)
            return (
              <li key={i}>
                <button
                  type="button"
                  className={onBoard ? 'seen-card hit' : 'seen-card'}
                  aria-label={`${s.count > 1 ? `${s.count} × ` : ''}${cardName(db, s.print)}`}
                  onClick={() => show({ kind: 'closeUp', print: s.print })}
                >
                  <CardFace db={db} print={s.print} />
                  {s.count > 1 && <span className="count">×{s.count}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
