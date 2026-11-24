import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { printLabel } from '../cards/ids.ts'
import type { Card } from '../cards/types.ts'

/** Preview size in CSS pixels; TCGdex scans are 245×337 (pokemontcg.io: 245×342). */
const WIDTH = 160
const HEIGHT = Math.round((WIDTH * 337) / 245)
/**
 * Gap between the name and the preview: wider beside it (clear of the pointer resting on
 * the name), narrower below or above it. EDGE is the minimum gap to the window edge.
 */
const SIDE_GAP = 32
const GAP = 12
const EDGE = 8
/** Hover delay, so sweeping the mouse across the table doesn't flash cards. */
const OPEN_DELAY = 150
/** After one preview closes, others open at once for this long (moving between rows). */
const WARM_FOR = 400

let lastClosed = -Infinity

/**
 * A card's name that shows a small image of the card: on mouse hover (after a short delay,
 * then instantly while moving between names), on keyboard focus, or on tap. Escape, a tap
 * elsewhere, or scrolling closes it. Images load from the card data's CDN; the site hosts
 * none. See docs/ux-guidelines.md.
 */
export default function CardName({ card, label = card.name }: { card: Card; label?: string }) {
  const button = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const pointerType = useRef('')
  // Where the name is on screen while the preview is open.
  const [anchor, setAnchor] = useState<DOMRect | null>(null)
  const open = anchor !== null

  const show = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnchor(button.current?.getBoundingClientRect() ?? null)
  }, [])
  const hide = useCallback(() => {
    window.clearTimeout(timer.current)
    setAnchor((was) => {
      if (was) lastClosed = performance.now()
      return null
    })
  }, [])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  // While open: a tap or click elsewhere, scrolling, or resizing closes it (the preview is
  // placed once, so it would drift from the name).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!button.current?.contains(e.target as Node)) hide()
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', hide, { capture: true, passive: true })
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', hide, { capture: true })
      window.removeEventListener('resize', hide)
    }
  }, [open, hide])

  return (
    <>
      <button
        ref={button}
        type="button"
        className="card-name"
        aria-expanded={open}
        onPointerDown={(e) => {
          pointerType.current = e.pointerType
        }}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'mouse') return
          const warm = performance.now() - lastClosed < WARM_FOR
          window.clearTimeout(timer.current)
          if (warm) show()
          else timer.current = window.setTimeout(show, OPEN_DELAY)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') hide()
        }}
        onClick={() => {
          // Mouse clicks leave hover in charge; taps and keyboard presses toggle.
          if (pointerType.current === 'mouse') show()
          else if (open) hide()
          else show()
          pointerType.current = ''
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show()
        }}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === 'Escape') hide()
        }}
      >
        {label}
      </button>
      {anchor && createPortal(<Preview card={card} anchor={anchor} />, document.body)}
    </>
  )
}

function Preview({ card, anchor }: { card: Card; anchor: DOMRect }) {
  const [failed, setFailed] = useState(false)
  const alt = `${card.name} (${printLabel(card.id)})`
  const hasImage = card.image !== undefined && !failed

  const style = place(anchor, hasImage ? HEIGHT : 64)

  return (
    <div className="card-preview" style={{ ...style, width: WIDTH }}>
      {hasImage ? (
        <img
          src={card.image}
          alt={alt}
          width={WIDTH}
          height={HEIGHT}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <p className="card-preview-missing">
          <strong>{alt}</strong>
          <br />
          No card image available yet.
        </p>
      )}
    </div>
  )
}

/**
 * Beside the name (right, else left), vertically centred on it; below or above it when the
 * window is too narrow for either side (phones). Always inside the window.
 */
function place(r: DOMRect, height: number): CSSProperties {
  const vw = document.documentElement.clientWidth
  const vh = window.innerHeight
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max))
  let left: number
  let top: number
  if (r.right + SIDE_GAP + WIDTH <= vw - EDGE) left = r.right + SIDE_GAP
  else if (r.left - SIDE_GAP - WIDTH >= EDGE) left = r.left - SIDE_GAP - WIDTH
  else left = NaN
  if (Number.isNaN(left)) {
    left = clamp(r.left, EDGE, vw - WIDTH - EDGE)
    top = r.bottom + GAP + height <= vh - EDGE ? r.bottom + GAP : r.top - GAP - height
  } else {
    top = r.top + r.height / 2 - height / 2
  }
  return { left, top: clamp(top, EDGE, Math.max(EDGE, vh - height - EDGE)) }
}
