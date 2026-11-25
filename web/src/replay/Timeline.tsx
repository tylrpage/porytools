// The timeline: a bar of turn segments in each player's colour, with Knock Out and branch
// markers and a draggable position line. It is a real slider for keyboard and screen readers.
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { useViewer } from './context.ts'
import type { LogStep, TurnSpan } from './steps.ts'

const LONG_PRESS = 450

export default function Timeline({
  steps,
  spans,
  at,
  label,
  onSeek,
  onKey,
}: {
  steps: LogStep[]
  spans: TurnSpan[]
  at: number
  /** "Action 12 of 40, Your turn 2". */
  label: string
  onSeek: (pos: number) => void
  onKey: (e: KeyboardEvent) => void
}) {
  const v = useViewer()
  const bar = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const press = useRef<number | undefined>(undefined)
  const [tip, setTip] = useState<{ text: string; left: number } | null>(null)
  const cells = steps.length + 1
  const left = (pos: number) => `${((pos + 0.5) / cells) * 100}%`

  const posAt = (x: number) => {
    const r = bar.current!.getBoundingClientRect()
    if (r.width === 0) return at
    return Math.max(0, Math.min(cells - 1, Math.floor(((x - r.left) / r.width) * cells)))
  }

  const markers: { pos: number; text: string; kind: string; side?: string }[] = []
  steps.forEach((s, i) => {
    if (s.ko) markers.push({ pos: i + 1, text: s.ko.text, kind: 'ko', side: v.side(s.ko.owner) })
    if (s.branches.length)
      markers.push({ pos: i + 1, text: s.branches.map((b) => b.label).join(', '), kind: 'branch' })
  })

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    e.currentTarget.querySelector('input')?.focus()
    e.preventDefault()
    onSeek(posAt(e.clientX))
  }
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onSeek(posAt(e.clientX))
  }
  const onUp = () => {
    dragging.current = false
    window.clearTimeout(press.current)
  }

  const showTip = (text: string, pos: number) => setTip({ text, left: (pos + 0.5) / cells })

  return (
    <div className="timeline-wrap">
      {/* Pointer handling is on the bar; the range input under it is the slider for the
          keyboard and screen readers. */}
      <div
        ref={bar}
        className="timeline"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <input
          type="range"
          className="tl-input"
          aria-label="Action"
          min={0}
          max={cells - 1}
          value={at}
          aria-valuetext={label}
          onChange={(e) => onSeek(Number(e.target.value))}
          onKeyDown={onKey}
        />
        {spans.map((s) => (
          <span
            key={s.from}
            className={`tl-seg turn-${s.owner === null ? 'none' : v.side(s.owner)}`}
            style={{
              left: `${(s.from / cells) * 100}%`,
              width: `${((s.to - s.from + 1) / cells) * 100}%`,
            }}
          />
        ))}
        {markers.map((m, i) => (
          <span
            key={i}
            className={`tl-mark ${m.kind}${m.side ? ` side-${m.side}` : ''}`}
            style={{ left: left(m.pos) } as CSSProperties}
            onPointerEnter={(e) => e.pointerType === 'mouse' && showTip(m.text, m.pos)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setTip(null)}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return
              window.clearTimeout(press.current)
              press.current = window.setTimeout(() => {
                showTip(m.text, m.pos)
                window.setTimeout(() => setTip(null), 1500)
              }, LONG_PRESS)
            }}
          />
        ))}
        <span className="tl-handle" style={{ left: left(at) }} />
      </div>
      {tip && (
        <output className="tl-tip" style={{ left: `${tip.left * 100}%` }}>
          {tip.text}
        </output>
      )}
    </div>
  )
}
