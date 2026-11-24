import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { CardDb } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import CardName from '../components/CardName.tsx'
import CardSelect from '../components/CardSelect.tsx'
import { cardLabeler, cardOptions } from '../components/cardOptions.ts'
import HelpHeader from '../components/HelpHeader.tsx'
import Problems from '../components/Problems.tsx'
import usePrefetchCardImages from '../components/usePrefetchCardImages.ts'
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
  /** Set on single-card rows, whose name shows the card's image. */
  card?: Card
  /** A Basic Pokémon card row: gets the "only Basic" column. */
  basic?: boolean
}

function OddsTable({ entries, groups }: { entries: DeckEntry[]; groups: NamedGroup[] }) {
  const sections = groupBySection(entries)
  const stickyHead = useStickyHead()
  usePrefetchCardImages(entries.map((e) => e.card))
  const label = cardLabeler(entries)
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
      <tr key={row.key}>
        <td className="count">{row.count}</td>
        <th scope="row" className="sticky-col">
          {row.card ? <CardName card={row.card} label={row.name} /> : row.name}
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
      name: label(e.card),
      count: e.count,
      ids: new Set([e.card.id]),
      card: e.card,
      basic: isBasicPokemon(e.card),
    }))
  const groupRows = groups
    .filter((g) => g.ids.size > 0)
    .map((g) => ({ key: g.key, name: g.name, count: copiesIn(entries, g.ids), ids: g.ids }))

  return (
    <section>
      <h2>At least one copy</h2>
      <p className="muted small">
        Hover or tap a column name to see what it counts, or a card name to see the card.
      </p>
      <div className="table-scroll sticky-head" ref={stickyHead}>
        <table className="odds-table">
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
  const label = cardLabeler(entries)
  const update = (i: number, group: NamedGroup) =>
    onChange(groups.map((g, j) => (j === i ? group : g)))
  const add = () => {
    const n = groups.reduce((max, g) => Math.max(max, Number(g.key.split('-')[1])), 0) + 1
    onChange([...groups, { key: `custom-${n}`, name: `Group ${n}`, ids: new Set() }])
  }
  return (
    <section>
      <h2>Custom groups</h2>
      <p className="muted small">Count several cards as one, e.g. all your Pokémon search items.</p>
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
                {e.count} {label(e.card)}
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

interface ConditionState {
  key: string
  atLeast: number
}

/** The question's parts must all hold; within a part, any one alternative is enough. */
type PartState = ConditionState[]

function Question({ entries, groups }: { entries: DeckEntry[]; groups: NamedGroup[] }) {
  const options = cardOptions(entries, groups)
  const fresh = (): ConditionState => ({ key: options[0].key, atLeast: 1 })
  const [parts, setParts] = useState<PartState[]>([[fresh()]])
  const [turn, setTurn] = useState(2)

  // The deck can change under a question: fall back to the first card, clamp counts.
  const resolved = parts.map((part) =>
    part.map((c) => {
      const option = options.find((o) => o.key === c.key) ?? options[0]
      return { option, atLeast: Math.min(c.atLeast, copiesIn(entries, option.ids)) }
    }),
  )
  const draws = drawsBy(turn)
  const { p } = chance(
    entries,
    resolved.map((part) => part.map((c) => ({ group: c.option.ids, atLeast: c.atLeast }))),
    draws,
  )
  const conditionCount = parts.reduce((n, part) => n + part.length, 0)

  const update = (i: number, j: number, c: ConditionState) =>
    setParts(
      parts.map((part, pi) => (pi === i ? part.map((old, ci) => (ci === j ? c : old)) : part)),
    )
  const remove = (i: number, j: number) =>
    setParts(
      parts
        .map((part, pi) => (pi === i ? part.filter((_, ci) => ci !== j) : part))
        .filter((part) => part.length > 0),
    )
  const addAlternative = (i: number) =>
    setParts(parts.map((part, pi) => (pi === i ? [...part, fresh()] : part)))

  return (
    <section>
      <h2>Ask a question</h2>
      <div className="question">
        {resolved.map((part, i) => (
          <div key={i} className={part.length > 1 ? 'question-part alternatives' : 'question-part'}>
            {part.map((c, j) => (
              <div key={j} className="condition">
                <span>{j > 0 ? 'or at least' : i > 0 ? 'and at least' : 'At least'}</span>
                <select
                  aria-label="How many"
                  value={c.atLeast}
                  onChange={(e) =>
                    update(i, j, { key: c.option.key, atLeast: Number(e.target.value) })
                  }
                >
                  {Array.from({ length: Math.min(copiesIn(entries, c.option.ids), 7) }, (_, n) => (
                    <option key={n + 1}>{n + 1}</option>
                  ))}
                </select>
                <CardSelect
                  aria-label="Card or group"
                  entries={entries}
                  groups={groups}
                  value={c.option.key}
                  onChange={(key) => update(i, j, { key, atLeast: 1 })}
                />
                {conditionCount > 1 && (
                  <button type="button" aria-label="Remove condition" onClick={() => remove(i, j)}>
                    ×
                  </button>
                )}
                {j === part.length - 1 && (
                  <button type="button" onClick={() => addAlternative(i)}>
                    + or
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
        <button type="button" onClick={() => setParts([...parts, [fresh()]])}>
          + And card or group
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
  const options = cardOptions(entries, groups)
  const [key, setKey] = useState(options[0].key)
  const option = options.find((o) => o.key === key) ?? options[0]
  const dist = prizeDistribution(entries, option.ids)
  const copies = copiesIn(entries, option.ids)
  return (
    <section>
      <h2>Prizes</h2>
      <p>
        How many of{' '}
        <CardSelect
          aria-label="Prized card or group"
          entries={entries}
          groups={groups}
          value={option.key}
          onChange={setKey}
        />{' '}
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
