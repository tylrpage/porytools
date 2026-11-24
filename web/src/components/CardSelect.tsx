import type { DeckEntry } from '../deck/parse.ts'
import type { NamedGroup } from '../odds/groups.ts'
import { cardSections } from './cardOptions.ts'

/**
 * The shared dropdown for picking a card or group from a deck. Use it for every such
 * picker so they all list choices the same way, with the same section separators.
 * Look up the selected key with `cardOptions` from `./cardOptions.ts`.
 */
export default function CardSelect({
  entries,
  groups,
  value,
  onChange,
  'aria-label': ariaLabel,
}: {
  entries: DeckEntry[]
  groups: NamedGroup[]
  value: string
  onChange: (key: string) => void
  'aria-label': string
}) {
  return (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
      {cardSections(entries, groups).map((s) => (
        <optgroup key={s.label} label={s.label}>
          {s.options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
