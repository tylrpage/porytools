import { useState } from 'react'
import { Link } from 'react-router'
import type { CardDb } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import Problems from '../components/Problems.tsx'
import { usePinnedRow } from '../components/usePinnedRow.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { SAMPLE_DECKLIST } from '../deck/sample.ts'
import { groupBySection } from '../deck/share.ts'
import { useDeckText } from '../deck/useDeckText.ts'

export default function Deck() {
  const state = useCardDb()
  return (
    <>
      <h1>Deck</h1>
      {state.status === 'loading' && <p className="muted">Loading card data…</p>}
      {state.status === 'error' && <p className="problem error">{state.message}</p>}
      {state.status === 'ready' && <DeckEditor db={state.db} />}
    </>
  )
}

function DeckEditor({ db }: { db: CardDb }) {
  const { text, setText, entries, problems, shareParam } = useDeckText(db)
  const [copied, setCopied] = useState(false)

  const onChange = (value: string) => {
    setText(value)
    setCopied(false)
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
  }

  const total = entries.reduce((n, e) => n + e.count, 0)
  const errors = problems.filter((p) => p.severity === 'error').length

  return (
    <>
      <p>
        Paste a decklist exported from PTCG Live or Limitless. Only Standard-legal cards (regulation
        mark {db.data.oldestLegalMark} and newer) are recognized.
      </p>
      <button type="button" className="sample-list" onClick={() => onChange(SAMPLE_DECKLIST)}>
        Use Sample List
      </button>
      <textarea
        className="decklist-input"
        aria-label="Decklist"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Pokémon: 12\n4 Dreepy TWM 128\n…'}
        rows={12}
        spellCheck={false}
      />
      {entries.length > 0 && (
        <>
          <div className="deck-summary">
            <strong>{total} cards</strong>
            {errors === 0 ? (
              <span className="ok">Valid Standard deck</span>
            ) : (
              <span className="problem error">{errors} problem(s)</span>
            )}
            <button type="button" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy share link'}
            </button>
            <Link to={`/odds?d=${shareParam}`}>Odds for this deck →</Link>
          </div>
          <Problems problems={problems} />
          <DeckList entries={entries} db={db} />
        </>
      )}
      {entries.length === 0 && <Problems problems={problems} />}
      <p className="muted small">
        Card data: {db.cards.length} cards from{' '}
        {db.data.sources.map((s, i) => (
          <span key={s.name}>
            {i > 0 && ' and '}
            <a href={s.url}>{s.name}</a>
          </span>
        ))}
        , updated {db.data.builtAt}.
      </p>
    </>
  )
}

function DeckList({ entries, db }: { entries: DeckEntry[]; db: CardDb }) {
  const pin = usePinnedRow()
  return (
    <div className="deck-sections" ref={pin.ref}>
      {groupBySection(entries).map(([section, list]) =>
        list.length === 0 ? null : (
          <section key={section}>
            <h2>
              {section} <span className="muted">({list.reduce((n, e) => n + e.count, 0)})</span>
            </h2>
            <table className="deck-table">
              <tbody>
                {list.map((e, i) => (
                  <tr
                    key={i}
                    data-row={`${section}:${i}`}
                    className={pin.rowClass(`${section}:${i}`)}
                  >
                    <td className="count">{e.count}</td>
                    <td>{e.card.name}</td>
                    <td className="muted">{describe(e.card)}</td>
                    <td className="muted print">{db.printLabel(e.card.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ),
      )}
    </div>
  )
}

function describe(card: Card): string {
  const parts: string[] = []
  if (card.kind === 'pokemon') parts.push(card.stage, ...card.tags.filter((t) => t !== 'ex'))
  if (card.kind === 'trainer') parts.push(card.trainer, ...card.tags)
  if (card.kind === 'energy') parts.push(card.basic ? 'Basic' : 'Special')
  if (card.aceSpec) parts.push('ACE SPEC')
  return parts.join(' · ')
}
