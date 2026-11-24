import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { CardDb } from '../cards/db.ts'
import { printLabel } from '../cards/ids.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import HelpHeader from '../components/HelpHeader.tsx'
import Problems from '../components/Problems.tsx'
import { usePinnedRow } from '../components/usePinnedRow.ts'
import { useStickyHead } from '../components/useStickyHead.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { SAMPLE_DECKLIST } from '../deck/sample.ts'
import { groupBySection } from '../deck/share.ts'
import { useDeckText } from '../deck/useDeckText.ts'
import { percent } from '../odds/format.ts'
import { builtInGroups, copiesIn, type NamedGroup } from '../odds/groups.ts'
import {
  chance,
  drawsBy,
  HAND_SIZE,
  isBasicPokemon,
  mulliganChance,
  onlyBasicChance,
  PRIZE_COUNT,
  prizeDistribution,
} from '../odds/odds.ts'

/** Turns offered in the question builder. */
const MAX_TURN = 6

export default function Odds() {
  const state = useCardDb()
  return (
    <>
      <h1>Odds</h1>
      {state.status === 'loading' && <p className="muted">Loading card data…</p>}
      {state.status === 'error' && <p className="problem error">{state.message}</p>}
      {state.status === 'ready' && <OddsTool db={state.db} />}
    </>
  )
}

function OddsTool({ db }: { db: CardDb }) {
  const deck = useDeckText(db)
  const [startOpen] = useState(deck.text === '')
  const [customGroups, setCustomGroups] = useState<NamedGroup[]>([])

  const entries = deck.entries
  const total = entries.reduce((n, e) => n + e.count, 0)
  const errors = deck.problems.filter((p) => p.severity === 'error').length
  const usable =
    total >= HAND_SIZE + PRIZE_COUNT + MAX_TURN && entries.some((e) => isBasicPokemon(e.card))

  // Keep custom groups to cards still in the deck when the list changes.
  const groups = useMemo(() => {
    const inDeck = new Set(entries.map((e) => e.card.id))
    const custom = customGroups.map((g) => ({
      ...g,
      ids: new Set([...g.ids].filter((id) => inDeck.has(id))),
    }))
    return { builtIn: builtInGroups(entries), custom }
  }, [entries, customGroups])

  return (
    <>
      <p>
        Exact odds of drawing and prizing your cards. Draws here are only the one at the start of
        each turn; search and draw effects come with the solver. All odds are after mulligans: every
        opening hand counted has a Basic Pokémon, as in the real game.
      </p>
      <details className="deck-input" open={startOpen}>
        <summary>
          Decklist{' '}
          {total > 0 && (
            <span className="muted">
              ({total} cards{errors > 0 && `, ${errors} problem(s)`})
            </span>
          )}
        </summary>
        <button type="button" className="sample-list" onClick={() => deck.setText(SAMPLE_DECKLIST)}>
          Use Sample List
        </button>
        <textarea
          className="decklist-input"
          aria-label="Decklist"
          value={deck.text}
          onChange={(e) => deck.setText(e.target.value)}
          placeholder={'Paste a PTCG Live or Limitless decklist\nPokémon: 12\n4 Dreepy TWM 128\n…'}
          rows={10}
          spellCheck={false}
        />
        <Problems problems={deck.problems} />
        {deck.shareParam && <Link to={`/deck?d=${deck.shareParam}`}>View deck →</Link>}
      </details>

      {!usable && (
        <p className="muted">
          {total === 0
            ? 'Paste a decklist to see its odds.'
            : 'The odds need a deck with at least one Basic Pokémon and enough cards to deal a hand and prizes.'}
        </p>
      )}
      {usable && (
        <>
          {errors > 0 && (
            <p className="problem warning">
              The list isn&apos;t a legal Standard deck; the odds use it as listed ({total} cards).
            </p>
          )}
          <Summary entries={entries} />
          <OddsTable entries={entries} groups={[...groups.builtIn, ...groups.custom]} />
          <CustomGroups entries={entries} groups={customGroups} onChange={setCustomGroups} />
          <Question entries={entries} groups={[...groups.builtIn, ...groups.custom]} />
          <PrizeBreakdown entries={entries} groups={[...groups.builtIn, ...groups.custom]} />
        </>
      )}
    </>
  )
}

function Summary({ entries }: { entries: DeckEntry[] }) {
  const basics = entries.filter((e) => isBasicPokemon(e.card)).reduce((n, e) => n + e.count, 0)
  const mulligan = mulliganChance(entries)
  return (
    <dl className="odds-summary">
      <div>
        <dt>Basic Pokémon</dt>
        <dd>{basics}</dd>
      </div>
      <div>
        <dt>Mulligan chance</dt>
        <dd>{percent(mulligan)}</dd>
      </div>
    </dl>
  )
}

interface Row {
  key: string
  name: string
  count: number
  ids: ReadonlySet<string>
  /** A Basic Pokémon card row: gets the "only Basic" column. */
  basic?: boolean
}

function OddsTable({ entries, groups }: { entries: DeckEntry[]; groups: NamedGroup[] }) {
  const sections = groupBySection(entries)
  const pin = usePinnedRow()
  const stickyHead = useStickyHead()
  const rowOdds = (row: Row) => {
    const atLeastOne = [{ group: row.ids, atLeast: 1 }]
    const prizes = prizeDistribution(entries, row.ids)
    return {
      turn1: chance(entries, atLeastOne, drawsBy(1)).p,
      turn2: chance(entries, atLeastOne, drawsBy(2)).p,
      allPrized: row.count <= PRIZE_COUNT ? prizes[row.count] : NaN,
      onlyBasic: row.basic ? onlyBasicChance(entries, row.ids) : null,
    }
  }
  const renderRow = (row: Row) => {
    const o = rowOdds(row)
    return (
      <tr key={row.key} data-row={row.key} className={pin.rowClass(row.key)}>
        <td className="count">{row.count}</td>
        <th scope="row" className="sticky-col">
          {row.name}
        </th>
        <td>{percent(o.turn1)}</td>
        <td>{percent(o.turn2)}</td>
        <td>{percent(o.allPrized)}</td>
        <td>{o.onlyBasic === null ? '' : percent(o.onlyBasic)}</td>
      </tr>
    )
  }
  const cardRows = (list: DeckEntry[]) =>
    list.map((e) => ({
      key: `card:${e.card.id}`,
      name: e.card.name,
      count: e.count,
      ids: new Set([e.card.id]),
      basic: isBasicPokemon(e.card),
    }))
  const groupRows = groups
    .filter((g) => g.ids.size > 0)
    .map((g) => ({ key: g.key, name: g.name, count: copiesIn(entries, g.ids), ids: g.ids }))

  return (
    <section>
      <h2>At least one copy</h2>
      <p className="muted small">Hover or tap a column name to see what it counts.</p>
      <div className="table-scroll sticky-head" ref={stickyHead}>
        <table className="odds-table" ref={pin.ref}>
          <thead>
            <tr>
              <th className="count">#</th>
              <th className="sticky-col">Card</th>
              <HelpHeader
                label="Turn 1"
                help="At least one copy seen by your first turn, counting that turn's draw."
              />
              <HelpHeader
                label="Turn 2"
                help="At least one copy seen by your second turn, counting that turn's draw."
              />
              <HelpHeader label="All prized" help="Every copy is in your prizes." />
              <HelpHeader
                label="Only Basic"
                help="The only Basic Pokémon in your opening hand (one or more copies), so it must start Active."
              />
            </tr>
          </thead>
          {sections.map(([section, list]) =>
            list.length === 0 ? null : (
              <tbody key={section}>
                <tr className="section-row">
                  <th colSpan={6}>
                    <span>{section}</span>
                  </th>
                </tr>
                {cardRows(list).map(renderRow)}
              </tbody>
            ),
          )}
          {groupRows.length > 0 && (
            <tbody>
              <tr className="section-row">
                <th colSpan={6}>
                  <span>Groups</span>
                </th>
              </tr>
              {groupRows.map(renderRow)}
            </tbody>
          )}
        </table>
      </div>
    </section>
  )
}

function CustomGroups({
  entries,
  groups,
  onChange,
}: {
  entries: DeckEntry[]
  groups: NamedGroup[]
  onChange: (groups: NamedGroup[]) => void
}) {
  const update = (i: number, group: NamedGroup) =>
    onChange(groups.map((g, j) => (j === i ? group : g)))
  const add = () => {
    const n = groups.reduce((max, g) => Math.max(max, Number(g.key.split('-')[1])), 0) + 1
    onChange([...groups, { key: `custom-${n}`, name: `Group ${n}`, ids: new Set() }])
  }
  return (
    <section>
      <h2>Custom groups</h2>
      <p className="muted small">
        Count several cards as one, e.g. every Pokémon that can start, or all your search Items.
      </p>
      {groups.map((g, i) => (
        <fieldset key={g.key} className="group-editor">
          <legend>
            <input
              aria-label="Group name"
              value={g.name}
              onChange={(e) => update(i, { ...g, name: e.target.value })}
            />
            <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))}>
              Remove
            </button>
          </legend>
          <div className="group-cards">
            {entries.map((e) => (
              <label key={e.card.id}>
                <input
                  type="checkbox"
                  checked={g.ids.has(e.card.id)}
                  onChange={(ev) => {
                    const ids = new Set(g.ids)
                    if (ev.target.checked) ids.add(e.card.id)
                    else ids.delete(e.card.id)
                    update(i, { ...g, ids })
                  }}
                />{' '}
                {e.count} {e.card.name}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="button" onClick={add}>
        New group
      </button>
    </section>
  )
}

interface Option {
  key: string
  label: string
  ids: ReadonlySet<string>
}

/** Cards, then groups, as choices for a question. Same-name cards get their print label. */
function groupOptions(entries: DeckEntry[], groups: NamedGroup[]): Option[] {
  const names = new Map<string, number>()
  for (const e of entries) names.set(e.card.name, (names.get(e.card.name) ?? 0) + 1)
  return [
    ...entries.map((e) => ({
      key: `card:${e.card.id}`,
      label:
        (names.get(e.card.name) ?? 0) > 1
          ? `${e.card.name} (${printLabel(e.card.id)})`
          : e.card.name,
      ids: new Set([e.card.id]),
    })),
    ...groups.filter((g) => g.ids.size > 0).map((g) => ({ key: g.key, label: g.name, ids: g.ids })),
  ]
}

interface ConditionState {
  key: string
  atLeast: number
}

function Question({ entries, groups }: { entries: DeckEntry[]; groups: NamedGroup[] }) {
  const options = groupOptions(entries, groups)
  const [conditions, setConditions] = useState<ConditionState[]>([
    { key: options[0].key, atLeast: 1 },
  ])
  const [turn, setTurn] = useState(2)

  // The deck can change under a question: fall back to the first card, clamp counts.
  const resolved = conditions.map((c) => {
    const option = options.find((o) => o.key === c.key) ?? options[0]
    return { option, atLeast: Math.min(c.atLeast, copiesIn(entries, option.ids)) }
  })
  const draws = drawsBy(turn)
  const { p } = chance(
    entries,
    resolved.map((c) => ({ group: c.option.ids, atLeast: c.atLeast })),
    draws,
  )

  const update = (i: number, c: ConditionState) =>
    setConditions(conditions.map((old, j) => (j === i ? c : old)))

  return (
    <section>
      <h2>Ask a question</h2>
      <div className="question">
        {resolved.map((c, i) => (
          <div key={i} className="condition">
            <span>{i === 0 ? 'At least' : 'and at least'}</span>
            <select
              aria-label="How many"
              value={c.atLeast}
              onChange={(e) => update(i, { key: c.option.key, atLeast: Number(e.target.value) })}
            >
              {Array.from({ length: Math.min(copiesIn(entries, c.option.ids), 7) }, (_, n) => (
                <option key={n + 1}>{n + 1}</option>
              ))}
            </select>
            <select
              aria-label="Card or group"
              value={c.option.key}
              onChange={(e) => update(i, { key: e.target.value, atLeast: 1 })}
            >
              <optgroup label="Cards">
                {options
                  .filter((o) => o.key.startsWith('card:'))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Groups">
                {options
                  .filter((o) => !o.key.startsWith('card:'))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            </select>
            {conditions.length > 1 && (
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setConditions([...conditions, { key: options[0].key, atLeast: 1 }])}
        >
          + Add card or group
        </button>
        <div className="condition">
          <span>by</span>
          <select
            aria-label="By when"
            value={turn}
            onChange={(e) => setTurn(Number(e.target.value))}
          >
            {Array.from({ length: MAX_TURN }, (_, t) => (
              <option key={t + 1} value={t + 1}>
                your turn {t + 1}
              </option>
            ))}
          </select>
          <span className="muted small">
            ({HAND_SIZE} + {draws} cards seen)
          </span>
        </div>
        <p className="answer" aria-live="polite">
          {percent(p)}
        </p>
      </div>
    </section>
  )
}

function PrizeBreakdown({ entries, groups }: { entries: DeckEntry[]; groups: NamedGroup[] }) {
  const options = groupOptions(entries, groups)
  const [key, setKey] = useState(options[0].key)
  const option = options.find((o) => o.key === key) ?? options[0]
  const dist = prizeDistribution(entries, option.ids)
  const copies = copiesIn(entries, option.ids)
  return (
    <section>
      <h2>Prizes</h2>
      <p>
        How many of{' '}
        <select
          aria-label="Prized card or group"
          value={option.key}
          onChange={(e) => setKey(e.target.value)}
        >
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>{' '}
        <span className="muted">({copies} in deck)</span> end up prized
      </p>
      <div className="table-scroll">
        <table className="odds-table prize-table">
          <thead>
            <tr>
              <th>Prized</th>
              {dist.map((_, n) => (
                <th key={n}>{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Chance</th>
              {dist.map((p, n) => (
                <td key={n}>{percent(p)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
