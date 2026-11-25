import CardName from '../components/CardName.tsx'
import type { CardRef, Part } from '../game/replay.ts'
import type { Flag } from '../game/types/Flag'
import { useViewer } from './context.ts'
import { cardName } from './steps.ts'

/** A description, with card names in their owner's colour and the card on hover. */
export function Text({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => (typeof p === 'string' ? p : <Ref key={i} card={p} />))}</>
}

function Ref({ card }: { card: CardRef }) {
  const { db, side } = useViewer()
  if (card.print === null) return <span className="muted">unknown card</span>
  const data = db.cardOfPrint(card.print)
  const cls = card.owner === undefined ? undefined : `player-${side(card.owner)}`
  return <span className={cls}>{data ? <CardName card={data} /> : db.printLabel(card.print)}</span>
}

/** A player's name in their colour. */
export function Player({ player }: { player: number }) {
  const { side, name } = useViewer()
  return <span className={`player player-${side(player)}`}>{name(player)}</span>
}

/** The `guessed` / `inferred` tag; a guessed one lists the alternatives on hover or tap. */
export function FlagTag({ flag, alternatives }: { flag?: Flag; alternatives: CardRef[] }) {
  const { db } = useViewer()
  if (!flag) return null
  const help =
    flag === 'inferred'
      ? 'Not in the source: worked out from the rules or the card.'
      : `A guess between look-alike cards.${
          alternatives.length
            ? ` It could also be: ${alternatives.map((a) => cardName(db, a.print)).join(', ')}.`
            : ''
        }`
  return (
    <span className="col-help flag-tag">
      <button
        type="button"
        aria-label={`${flag}: ${help}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur()
        }}
      >
        {flag}
      </button>
      <span role="tooltip">{help}</span>
    </span>
  )
}
