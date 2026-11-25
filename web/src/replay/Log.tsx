// The log: every action of the line shown, oldest first under turn headers. Tapping an entry
// jumps there; its changes open behind a chevron (automatically for the current action).
import { useLayoutEffect, useRef, useState } from 'react'
import CardFace from './CardFace.tsx'
import { useViewer } from './context.ts'
import { cardName, partsText, type LogStep } from './steps.ts'
import { FlagTag, Player, Text } from './Text.tsx'

export default function Log({
  steps,
  at,
  onJump,
  onBranch,
}: {
  steps: LogStep[]
  /** Current position: 0 is the start, k is after steps[k - 1]. */
  at: number
  onJump: (pos: number) => void
  onBranch: (node: number) => void
}) {
  const v = useViewer()
  // Entries opened or closed by hand; the rest follow "open when current".
  const [toggled, setToggled] = useState<Map<number, boolean>>(new Map())

  // Keep the current action in view (scrolling the log, not the page).
  const list = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    const box = list.current
    const item = box?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!box || !item) return
    const b = box.getBoundingClientRect()
    const r = item.getBoundingClientRect()
    if (r.top < b.top) box.scrollTop += r.top - b.top
    else if (r.bottom > b.bottom) box.scrollTop += Math.min(r.bottom - b.bottom, r.top - b.top)
  }, [at, steps])

  return (
    <ol className="log" ref={list}>
      <li
        className={at === 0 ? 'log-entry current' : 'log-entry'}
        aria-current={at === 0 ? 'step' : undefined}
      >
        <button type="button" className="log-jump" onClick={() => onJump(0)}>
          Start of the game
        </button>
      </li>
      {steps.map((s, i) => {
        const pos = i + 1
        const current = pos === at
        const open = toggled.get(s.node) ?? current
        const header = i === 0 || steps[i - 1].turnText !== s.turnText
        const side = s.turnOwner === null ? 'none' : v.side(s.turnOwner)
        return (
          <li key={s.node} className="log-item">
            {header && <h3 className={`log-turn turn-${side}`}>{s.turnText}</h3>}
            {s.branches.map((b) => (
              <button
                key={b.node}
                type="button"
                className="log-branch"
                onClick={() => onBranch(b.node)}
              >
                ↳ {b.label}
              </button>
            ))}
            <div
              className={`log-entry${current ? ' current' : ''}${pos > at ? ' later' : ''}`}
              aria-current={current ? 'step' : undefined}
            >
              {/* Covers the whole entry; the card names and buttons sit above it. */}
              <button
                type="button"
                className="log-jump"
                aria-label={`Go to action ${pos}: ${s.actor !== null ? `${v.name(s.actor)}: ` : ''}${partsText(v.db, s.text)}`}
                onClick={() => onJump(pos)}
              />
              {s.main ? (
                <button
                  type="button"
                  className="log-thumb"
                  aria-label={`Close-up: ${cardName(v.db, s.main.print)}`}
                  onClick={() => v.show({ kind: 'closeUp', print: s.main!.print })}
                >
                  <CardFace db={v.db} print={s.main.print} />
                </button>
              ) : (
                <span className="log-thumb none" />
              )}
              <span className="log-text">
                {s.actor !== null && (
                  <>
                    <Player player={s.actor} />:{' '}
                  </>
                )}
                <Text parts={s.text} /> <FlagTag flag={s.flag} alternatives={s.alternatives} />
              </span>
              {s.changes.length > 0 && (
                <button
                  type="button"
                  className="log-chevron"
                  aria-expanded={open}
                  aria-label={open ? 'Hide the changes' : 'Show the changes'}
                  onClick={() => setToggled((m) => new Map(m).set(s.node, !open))}
                >
                  {open ? '▾' : '▸'}
                </button>
              )}
              {open && s.changes.length > 0 && (
                <ul className="log-changes">
                  {s.changes.map((c, j) => (
                    <li key={j}>
                      <Text parts={c.text} />{' '}
                      <FlagTag flag={c.flag} alternatives={c.alternatives} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
