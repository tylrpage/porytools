import { useState } from 'react'
import type { CardDb } from '../cards/db.ts'
import { printLabel } from '../cards/ids.ts'

/**
 * A card on the board: its small image from the card data's CDN (never hosted here), a drawn
 * face when there's no image, or our own card back for cards the viewer doesn't know. The
 * size comes from the parent; labels go on the button around it, so the image has no alt.
 */
export default function CardFace(props: {
  db: CardDb
  print: string | null
  back?: boolean
  alt?: string
}) {
  // Keyed by print, so a failed image doesn't stick to the next card shown here.
  return <Face key={props.print ?? ''} {...props} />
}

function Face({
  db,
  print,
  back = false,
  alt = '',
}: {
  db: CardDb
  print: string | null
  back?: boolean
  alt?: string
}) {
  const [failed, setFailed] = useState(false)
  if (back || print === null) return <span className="rc rc-back" />
  const card = db.cardOfPrint(print)
  if (card?.image && !failed) {
    return (
      <img
        className="rc"
        src={card.image}
        alt={alt}
        decoding="async"
        draggable={false}
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span className="rc rc-blank">
      <span className="rc-name">{card?.name ?? printLabel(print)}</span>
      {card?.kind === 'pokemon' && (
        <span className="rc-info">
          {card.hp} HP · {card.types.join(' / ')}
        </span>
      )}
      {card?.kind === 'trainer' && <span className="rc-info">{card.trainer}</span>}
      {card?.kind === 'energy' && <span className="rc-info">Energy</span>}
    </span>
  )
}
