import { printLabel } from '../cards/ids.ts'
import type { DeckEntry } from '../deck/parse.ts'
import { groupBySection } from '../deck/share.ts'
import type { NamedGroup } from '../odds/groups.ts'

/** One choice in a card picker: a single card or a group of cards. */
export interface CardOption {
  key: string
  label: string
  ids: ReadonlySet<string>
}

export interface CardOptionSection {
  label: string
  options: CardOption[]
}

/**
 * The deck's cards by section (Pokémon, Trainer, Energy), then non-empty groups. Empty
 * sections are left out. Same-name cards get their print label so they can be told apart.
 */
export function cardSections(entries: DeckEntry[], groups: NamedGroup[]): CardOptionSection[] {
  const names = new Map<string, number>()
  for (const e of entries) names.set(e.card.name, (names.get(e.card.name) ?? 0) + 1)
  const cardOption = (e: DeckEntry): CardOption => ({
    key: `card:${e.card.id}`,
    label:
      (names.get(e.card.name) ?? 0) > 1 ? `${e.card.name} (${printLabel(e.card.id)})` : e.card.name,
    ids: new Set([e.card.id]),
  })
  const sections: CardOptionSection[] = groupBySection(entries).map(([section, list]) => ({
    label: section,
    options: list.map(cardOption),
  }))
  sections.push({
    label: 'Groups',
    options: groups
      .filter((g) => g.ids.size > 0)
      .map((g) => ({ key: g.key, label: g.name, ids: g.ids })),
  })
  return sections.filter((s) => s.options.length > 0)
}

/** Every choice a `CardSelect` offers, in its order, for looking up the selected key. */
export function cardOptions(entries: DeckEntry[], groups: NamedGroup[]): CardOption[] {
  return cardSections(entries, groups).flatMap((s) => s.options)
}
