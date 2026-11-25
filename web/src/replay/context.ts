// What every part of the viewer needs: the card data, the state shown, the current action's
// focus, player names and colours, and a way to open a close-up or a card list.
import { createContext, useContext } from 'react'
import type { CardDb } from '../cards/db.ts'
import type { EnergyType } from '../cards/types.ts'
import { CONDITIONS, type Focus } from '../game/replay.ts'
import type { State } from '../game/solver.ts'
import type { Pokemon } from '../game/types/Pokemon'
import { cardName } from './steps.ts'

/** Same cards counted together; `print` null for cards the viewer doesn't know. */
export interface ListItem {
  print: string | null
  count: number
}
export interface ListSection {
  label?: string
  items: ListItem[]
  /** Shown instead of (or after) the items, e.g. "40 cards in unknown order". */
  note?: string
}

export type Shown =
  | { kind: 'closeUp'; print: string | null; sections?: ListSection[] }
  | { kind: 'list'; title: string; sections: ListSection[] }

/** "a": the bottom player's colour, "b": the top player's. */
export type Side = 'a' | 'b'

export interface Viewer {
  db: CardDb
  state: State
  focus: Focus | null
  side(player: number): Side
  name(player: number): string
  show(shown: Shown): void
}

export const ViewerContext = createContext<Viewer | null>(null)

export function useViewer(): Viewer {
  const v = useContext(ViewerContext)
  if (!v) throw new Error('useViewer outside the replay viewer')
  return v
}

/** Groups cards by print, in order of first appearance, unknown cards last. */
export function group(state: State, ids: number[]): ListItem[] {
  const counts = new Map<string, number>()
  let unknown = 0
  for (const id of ids) {
    const print = state.cards[id]?.card
    if (print) counts.set(print, (counts.get(print) ?? 0) + 1)
    else unknown++
  }
  const items: ListItem[] = [...counts].map(([print, count]) => ({ print, count }))
  if (unknown) items.push({ print: null, count: unknown })
  return items
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "2 Grass Energy, Ultra Ball, 1 unknown card". */
export function itemsText(db: CardDb, items: ListItem[]): string {
  return items
    .map(({ print, count }) =>
      print === null
        ? plural(count, 'unknown card')
        : `${count > 1 ? `${count} ` : ''}${cardName(db, print).replace(/^Basic /, '')}`,
    )
    .join(', ')
}

export function isTool(db: CardDb, print: string | null | undefined): boolean {
  const card = print ? db.cardOfPrint(print) : undefined
  return card?.kind === 'trainer' && card.trainer === 'Pokémon Tool'
}

/** The type a basic Energy provides; "special" for other Energy; "unknown" when not known. */
export function energyKind(
  db: CardDb,
  print: string | null | undefined,
): EnergyType | 'special' | 'unknown' {
  const card = print ? db.cardOfPrint(print) : undefined
  if (!card) return 'unknown'
  if (card.kind === 'energy' && card.basic && card.provides) return card.provides
  return 'special'
}

export function conditionLabels(mon: Pokemon): string[] {
  const c = mon.conditions
  const labels: string[] = []
  if (c.rotation) labels.push(CONDITIONS[c.rotation])
  if (c.poisoned) labels.push(CONDITIONS.poisoned)
  if (c.burned) labels.push(CONDITIONS.burned)
  return labels
}

/** "Active: Dartrix, 20 damage, 1 Grass Energy, Asleep". */
export function pokemonLabel(v: Viewer, mon: Pokemon, where: string): string {
  const { db, state } = v
  const top = mon.stack[mon.stack.length - 1]
  const print = state.cards[top]?.card ?? null
  const facts: string[] = []
  facts.push(
    mon.faceDown ? `face down${print ? ` (${cardName(db, print)})` : ''}` : cardName(db, print),
  )
  if (mon.counters) facts.push(`${mon.counters * 10} damage`)
  const tools = mon.attached.filter((id) => isTool(db, state.cards[id]?.card))
  const other = mon.attached.filter((id) => !tools.includes(id))
  if (other.length) facts.push(itemsText(db, group(state, other)))
  if (tools.length) facts.push(`Tool: ${itemsText(db, group(state, tools))}`)
  if (mon.stack.length > 1)
    facts.push(`evolved from ${itemsText(db, group(state, mon.stack.slice(0, -1)))}`)
  facts.push(...conditionLabels(mon))
  if (touched(v, [...mon.stack, ...mon.attached])) facts.push('changed by this action')
  return `${where}: ${facts.join(', ')}`
}

export function touched(v: Viewer, ids: number[]): boolean {
  return v.focus !== null && ids.some((id) => v.focus!.touched.has(id))
}
