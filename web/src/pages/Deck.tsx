import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { CardDb } from '../cards/db.ts'
import type { Card } from '../cards/types.ts'
import { useCardDb } from '../cards/useCardDb.ts'
import { type DeckEntry, type Problem, parseDecklist } from '../deck/parse.ts'
import { decodeDeck, encodeDeck, formatDecklist, groupBySection } from '../deck/share.ts'
import { validateDeck } from '../deck/validate.ts'

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
  const [params, setParams] = useSearchParams()
  // A share link fills the text box once, on first render.
  const [text, setText] = useState(() => {
    const shared = params.get('d')
    return shared ? formatDecklist(decodeDeck(shared, db).entries, db) : ''
  })
  const [copied, setCopied] = useState(false)

  const { entries, problems } = useMemo(() => {
    const parsed = parseDecklist(text, db)
    const checked = parsed.entries.length > 0 ? validateDeck(parsed.entries, db) : []
    return { entries: parsed.entries, problems: [...parsed.problems, ...checked] }
  }, [text, db])

  const onChange = (value: string) => {
    setText(value)
    setCopied(false)
    // Keep the address bar a share link for whatever is in the box.
    const parsed = parseDecklist(value, db)
    setParams(parsed.entries.length > 0 ? { d: encodeDeck(parsed.entries) } : {}, { replace: true })
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
          </div>
          <Problems problems={problems} />
          <DeckList entries={entries} db={db} />
        </>
      )}
      {entries.length === 0 && <Problems problems={problems} />}
      <p className="muted small">
        Card data: {db.cards.length} cards from{' '}
        <a href={`https://github.com/${db.data.source.repo}`}>{db.data.source.repo}</a>, updated{' '}
        {db.data.source.fetchedAt}.
      </p>
    </>
  )
}

function Problems({ problems }: { problems: Problem[] }) {
  if (problems.length === 0) return null
  return (
    <ul className="problems">
      {problems.map((p, i) => (
        <li key={i} className={`problem ${p.severity}`}>
          {p.line !== undefined && <span className="muted">Line {p.line}: </span>}
          {p.message}
        </li>
      ))}
    </ul>
  )
}

function DeckList({ entries, db }: { entries: DeckEntry[]; db: CardDb }) {
  return (
    <div className="deck-sections">
      {groupBySection(entries).map(([section, list]) =>
        list.length === 0 ? null : (
          <section key={section}>
            <h2>
              {section} <span className="muted">({list.reduce((n, e) => n + e.count, 0)})</span>
            </h2>
            <table className="deck-table">
              <tbody>
                {list.map((e, i) => (
                  <tr key={i}>
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
