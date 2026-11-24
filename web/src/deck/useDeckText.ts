import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import type { CardDb } from '../cards/db.ts'
import { sortEntries } from './order.ts'
import { type DeckEntry, type Problem, parseDecklist } from './parse.ts'
import { decodeDeck, encodeDeck, formatDecklist } from './share.ts'
import { validateDeck } from './validate.ts'

export interface DeckText {
  text: string
  setText: (text: string) => void
  /** One per card, in display order (see `sortEntries`). */
  entries: DeckEntry[]
  /** Parse problems, then deck-rule problems. */
  problems: Problem[]
  /** The `?d=` share link value, or '' for an empty list. Pages pass it along in links. */
  shareParam: string
}

/**
 * The decklist in a text box, kept in sync with the `?d=` share link in the address bar.
 * The deck page and the odds page both use this, so a link opens the same list on either.
 */
export function useDeckText(db: CardDb): DeckText {
  const [params, setParams] = useSearchParams()
  // A share link fills the text box once, on first render.
  const [text, setTextState] = useState(() => {
    const shared = params.get('d')
    return shared ? formatDecklist(decodeDeck(shared, db).lines, db) : ''
  })

  const parsed = useMemo(() => {
    const result = parseDecklist(text, db)
    const checked = result.entries.length > 0 ? validateDeck(result.entries, db) : []
    return {
      entries: sortEntries(result.entries, db),
      problems: [...result.problems, ...checked],
      shareParam: result.lines.length > 0 ? encodeDeck(result.lines) : '',
    }
  }, [text, db])

  const setText = (value: string) => {
    setTextState(value)
    // Keep the address bar a share link for whatever is in the box, prints as written.
    const lines = parseDecklist(value, db).lines
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (lines.length > 0) next.set('d', encodeDeck(lines))
        else next.delete('d')
        return next
      },
      { replace: true },
    )
  }

  return { text, setText, ...parsed }
}
