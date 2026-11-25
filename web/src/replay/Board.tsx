// The table, laid out like the playmat in porytools' own look: prizes left, deck and discard
// right, the Active Spot in the centre with the Bench behind it, the Stadium on the middle
// line. The top player is mirrored top to bottom only (Active nearest the middle line), so
// both players' prizes are on the left. See docs/replay-viewer.md.
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Pokemon } from '../game/types/Pokemon'
import CardFace from './CardFace.tsx'
import {
  conditionLabels,
  energyKind,
  group,
  isTool,
  itemsText,
  plural,
  pokemonLabel,
  touched,
  useViewer,
  type ListSection,
} from './context.ts'
import { cardName } from './steps.ts'

const vars = (v: Record<string, number>) => v as CSSProperties

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ')

export default function Board({ bottom, caption }: { bottom: number; caption: ReactNode }) {
  const { state } = useViewer()
  const top = 1 - bottom
  // Cards are only pending inside an action; if a record leaves some there, show them.
  const pending = [...state.players[top].pending, ...state.players[bottom].pending]
  return (
    <div className="board-box">
      <div className="board">
        <PlayerArea player={top} at="top" />
        <div className="mid">
          <Stadium />
          <div className="caption" aria-live="polite">
            {caption}
          </div>
          {pending.length > 0 && <Pending ids={pending} />}
        </div>
        <PlayerArea player={bottom} at="bottom" />
      </div>
    </div>
  )
}

function PlayerArea({ player, at }: { player: number; at: 'top' | 'bottom' }) {
  const v = useViewer()
  const p = v.state.players[player]
  return (
    <section className={`area ${at} side-${v.side(player)}`} aria-label={v.name(player)}>
      {at === 'top' && <HandStrip player={player} />}
      <div className="mat">
        <Prizes player={player} />
        <div className="active-row">
          {p.active ? (
            <PokemonCard mon={p.active} where="Active" />
          ) : (
            <span className="slot">
              <span className="visually-hidden">Active Spot: empty</span>
            </span>
          )}
        </div>
        <div className="bench-row">
          {p.bench.map((mon) => (
            <PokemonCard key={mon.stack[0]} mon={mon} where="Bench" />
          ))}
        </div>
        <div className="deck-cell">
          <Deck player={player} />
        </div>
        <div className="discard-cell">
          {p.lostZone.length > 0 && <Discard player={player} lost />}
          <Discard player={player} />
        </div>
      </div>
      {at === 'bottom' && <Hand player={player} />}
    </section>
  )
}

function PokemonCard({ mon, where }: { mon: Pokemon; where: string }) {
  const v = useViewer()
  const { db, state } = v
  const top = mon.stack[mon.stack.length - 1]
  const print = state.cards[top]?.card ?? null
  const under = mon.stack.slice(0, -1)
  const tools = mon.attached.filter((id) => isTool(db, state.cards[id]?.card))
  const energy = mon.attached.filter((id) => !tools.includes(id))
  const conditions = conditionLabels(mon)
  const sections: ListSection[] = []
  if (under.length) sections.push({ label: 'Evolved from', items: group(state, under) })
  if (mon.attached.length) sections.push({ label: 'Attached', items: group(state, mon.attached) })
  return (
    <button
      type="button"
      className={cls('mon', touched(v, [...mon.stack, ...mon.attached]) && 'hit')}
      data-rot={mon.conditions.rotation ?? undefined}
      aria-label={pokemonLabel(v, mon, where)}
      onClick={() => v.show({ kind: 'closeUp', print: mon.faceDown ? null : print, sections })}
    >
      <span className="mon-card">
        {under.map((id, i) => (
          <span key={id} className="mon-under" style={vars({ '--i': under.length - i })} />
        ))}
        {tools.map((id, i) => (
          <span key={id} className="mon-tool" style={vars({ '--i': i })}>
            <CardFace db={db} print={state.cards[id]?.card ?? null} />
          </span>
        ))}
        <CardFace db={db} print={print} back={mon.faceDown} />
        {mon.counters > 0 && <span className="mon-damage">{mon.counters * 10}</span>}
        {energy.length > 0 && (
          <span className="mon-energy">
            {energy.map((id) => (
              <span key={id} className="energy" data-type={energyKind(db, state.cards[id]?.card)} />
            ))}
          </span>
        )}
      </span>
      {conditions.length > 0 && (
        <span className="mon-conds">
          {conditions.map((c) => (
            <span key={c} className="cond">
              {c}
            </span>
          ))}
        </span>
      )}
    </button>
  )
}

function Prizes({ player }: { player: number }) {
  const v = useViewer()
  const { db, state } = v
  const prizes = state.players[player].prizes
  return (
    <button
      type="button"
      className={cls('prizes', touched(v, prizes) && 'hit')}
      aria-label={`Prizes: ${plural(prizes.length, 'card')}`}
      onClick={() =>
        v.show({
          kind: 'list',
          title: `Prizes (${prizes.length})`,
          sections: [{ items: group(state, prizes) }],
        })
      }
    >
      <span className="fan" style={vars({ '--n': prizes.length })}>
        {prizes.length === 0 && <span className="slot" />}
        {prizes.map((id, i) => (
          <span key={id} className="fan-card" style={vars({ '--i': i })}>
            <CardFace db={db} print={state.cards[id]?.card ?? null} />
          </span>
        ))}
      </span>
      <span className="count">{prizes.length}</span>
    </button>
  )
}

function Deck({ player }: { player: number }) {
  const v = useViewer()
  const { db, state } = v
  const deck = state.players[player].deck
  const count = deck.count + deck.top.length + deck.bottom.length
  const topPrint = deck.top.length ? (state.cards[deck.top[0]]?.card ?? null) : null
  const bottomPrint = deck.bottom.length
    ? (state.cards[deck.bottom[deck.bottom.length - 1]]?.card ?? null)
    : null
  const sections: ListSection[] = []
  if (deck.top.length) sections.push({ label: 'Top (top first)', items: group(state, deck.top) })
  sections.push(
    deck.contents
      ? {
          label: deck.top.length || deck.bottom.length ? 'In between, any order' : 'Any order',
          items: deck.contents.map(([print, n]) => ({ print, count: n })),
        }
      : {
          note: deck.count ? `${plural(deck.count, 'card')} in unknown order` : undefined,
          items: [],
        },
  )
  if (deck.bottom.length)
    sections.push({ label: 'Bottom (bottom last)', items: group(state, deck.bottom) })
  const hit = v.focus?.decks.has(player) || touched(v, [...deck.top, ...deck.bottom])
  const known = [
    topPrint && `top: ${cardName(db, topPrint)}`,
    bottomPrint && `bottom: ${cardName(db, bottomPrint)}`,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <button
      type="button"
      className={cls('pile', hit && 'hit')}
      aria-label={`Deck: ${plural(count, 'card')}${known ? `, ${known}` : ''}${hit ? ', changed by this action' : ''}`}
      onClick={() => v.show({ kind: 'list', title: `Deck (${count})`, sections })}
    >
      {count === 0 ? (
        <span className="slot" />
      ) : (
        <>
          {bottomPrint && !topPrint && (
            <span className="pile-under">
              <CardFace db={db} print={bottomPrint} />
            </span>
          )}
          <CardFace db={db} print={topPrint} />
        </>
      )}
      <span className="count">{count}</span>
    </button>
  )
}

function Discard({ player, lost = false }: { player: number; lost?: boolean }) {
  const v = useViewer()
  const { db, state } = v
  const p = state.players[player]
  const ids = lost ? p.lostZone : p.discard
  const name = lost ? 'Lost Zone' : 'Discard pile'
  const topPrint = ids.length ? (state.cards[ids[ids.length - 1]]?.card ?? null) : null
  const hit = touched(v, ids)
  const newestFirst = [...ids].reverse()
  return (
    <button
      type="button"
      className={cls('pile', lost && 'lost', hit && 'hit')}
      aria-label={`${name}: ${plural(ids.length, 'card')}${topPrint ? `, top: ${cardName(db, topPrint)}` : ''}${hit ? ', changed by this action' : ''}`}
      onClick={() =>
        v.show({
          kind: 'list',
          title: `${name} (${ids.length})`,
          sections: [
            {
              label: ids.length ? 'Newest first' : undefined,
              items: group(state, newestFirst),
              note: ids.length ? undefined : 'Empty',
            },
          ],
        })
      }
    >
      {ids.length === 0 ? <span className="slot" /> : <CardFace db={db} print={topPrint} />}
      <span className="count">{ids.length}</span>
      {lost && <span className="pile-name">Lost Zone</span>}
    </button>
  )
}

/** A vertical wheel over a row that scrolls sideways scrolls the row while it can move that
 *  way; at either end the page scrolls as usual. Needs a non-passive listener to stop the
 *  page scrolling, which React's onWheel can't do. */
function useWheelScrollsSideways<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 0) return
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientWidth : 1
      const dy = e.deltaY * unit
      if ((dy < 0 && el.scrollLeft <= 0) || (dy > 0 && el.scrollLeft >= max - 1)) return
      e.preventDefault()
      el.scrollLeft += dy
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])
  return ref
}

/** The bottom player's hand: full-size cards in a row that scrolls sideways, its label below
 *  (the player's own side, mirroring the top player's strip). */
function Hand({ player }: { player: number }) {
  const v = useViewer()
  const { db, state } = v
  const hand = state.players[player].hand
  const scroller = useWheelScrollsSideways<HTMLUListElement>()
  return (
    <div className="hand-row">
      <ul className="hand" aria-label="Hand" ref={scroller}>
        {hand.map((id) => {
          const print = state.cards[id]?.card ?? null
          const hit = touched(v, [id])
          return (
            <li key={id}>
              <button
                type="button"
                className={cls('hand-card', hit && 'hit')}
                aria-label={`${cardName(db, print)}${hit ? ', changed by this action' : ''}`}
                onClick={() => v.show({ kind: 'closeUp', print })}
              >
                <CardFace db={db} print={print} />
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="hand-label"
        aria-label={`Hand: ${plural(hand.length, 'card')}. Show the list`}
        onClick={() =>
          v.show({
            kind: 'list',
            title: `Hand (${hand.length})`,
            sections: [{ items: group(state, hand) }],
          })
        }
      >
        <HandLabel player={player} count={hand.length} />
      </button>
    </div>
  )
}

function HandLabel({ player, count }: { player: number; count: number }) {
  const v = useViewer()
  return (
    <>
      <span className={`player player-${v.side(player)}`}>{v.name(player)}</span> · Hand{' '}
      <strong>{count}</strong>
    </>
  )
}

/** The top player's hand: a thin strip of small cards (backs unless known) with a count. */
function HandStrip({ player }: { player: number }) {
  const v = useViewer()
  const { db, state } = v
  const hand = state.players[player].hand
  const items = group(state, hand)
  const hit = touched(v, hand)
  return (
    <button
      type="button"
      className={cls('hand-strip', hit && 'hit')}
      aria-label={`Hand: ${plural(hand.length, 'card')}${hand.length ? ` (${itemsText(db, items)})` : ''}${hit ? ', changed by this action' : ''}`}
      onClick={() =>
        v.show({ kind: 'list', title: `Hand (${hand.length})`, sections: [{ items }] })
      }
    >
      <span className="hand-label">
        <HandLabel player={player} count={hand.length} />
      </span>
      <span className="strip-cards">
        {hand.map((id) => (
          <span key={id} className={cls('strip-card', touched(v, [id]) && 'hit')}>
            <CardFace db={db} print={state.cards[id]?.card ?? null} />
          </span>
        ))}
      </span>
    </button>
  )
}

/** Two cards wide: a Legendary Stadium is two cards side by side. */
function Stadium() {
  const v = useViewer()
  const { db, state } = v
  const ids = state.stadium
  return (
    <div className="stadium">
      {ids.map((id) => {
        const print = state.cards[id]?.card ?? null
        const hit = touched(v, [id])
        return (
          <button
            key={id}
            type="button"
            className={cls('stadium-card', hit && 'hit')}
            aria-label={`Stadium: ${cardName(db, print)}${hit ? ', changed by this action' : ''}`}
            onClick={() => v.show({ kind: 'closeUp', print })}
          >
            <CardFace db={db} print={print} />
          </button>
        )
      })}
      {ids.length === 0 && <span className="slot stadium-empty">No Stadium</span>}
    </div>
  )
}

function Pending({ ids }: { ids: number[] }) {
  const v = useViewer()
  const { db, state } = v
  return (
    <div className="pending">
      <span className="pending-label">Being played</span>
      {ids.map((id) => {
        const print = state.cards[id]?.card ?? null
        return (
          <button
            key={id}
            type="button"
            className="pending-card"
            aria-label={cardName(db, print)}
            onClick={() => v.show({ kind: 'closeUp', print })}
          >
            <CardFace db={db} print={print} />
          </button>
        )
      })}
    </div>
  )
}
