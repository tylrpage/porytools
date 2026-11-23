import { useEffect, useState } from 'react'
import { type CardDb, loadCardDb } from './db.ts'

export type CardDbState =
  { status: 'loading' } | { status: 'ready'; db: CardDb } | { status: 'error'; message: string }

/** Load the card database (fetched once and shared by every page). */
export function useCardDb(): CardDbState {
  const [state, setState] = useState<CardDbState>({ status: 'loading' })
  useEffect(() => {
    let live = true
    loadCardDb().then(
      (db) => live && setState({ status: 'ready', db }),
      (e: unknown) => live && setState({ status: 'error', message: (e as Error).message }),
    )
    return () => {
      live = false
    }
  }, [])
  return state
}
