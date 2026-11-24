import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
 * The decklist in a text box, kept in sync with the `?d=` share link in the address bar
 * and saved in this browser. The deck page and the odds page both use this, so a link
 * opens the same list on either, and editing on one page carries over to the other.
 */
export function useDeckText(db: CardDb): DeckText {
  const [params, setParams] = useSearchParams()
  // On first render a share link fills the text box; otherwise the last list typed on
  // either page (saved in this browser) does. A share link also becomes the saved list.
  const [text, setTextState] = useState(() => {
    const shared = params.get('d')
    if (!shared) return loadSaved()
    const fromLink = formatDecklist(decodeDeck(shared, db).lines, db)
    save(fromLink)
    return fromLink
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

  // Keep the address bar a share link for whatever is in the box, prints as written.
  const syncLink = useCallback(
    (value: string) => {
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
    },
    [db, setParams],
  )

  // A list restored from storage arrives without `?d=`, so add it once (Copy link reads
  // the address bar).
  const restored = useRef(text !== '' && !params.get('d'))
  useEffect(() => {
    if (restored.current) {
      restored.current = false
      syncLink(text)
    }
  }, [syncLink, text])

  const setText = (value: string) => {
    setTextState(value)
    save(value)
    syncLink(value)
  }

  return { text, setText, ...parsed }
}

// The text box is saved in localStorage, so it survives leaving the page, reloads and
// browser restarts. It stays on this device and is never sent anywhere. Storage can be
// unavailable (private mode, blocked site data), so every access is guarded and the
// pages simply start empty then.
const STORAGE_KEY = 'porytools.decklist'

function loadSaved(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

function save(value: string) {
  try {
    if (value === '') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Not saved; the list still works for this visit.
  }
}
