import { useId } from 'react'

/**
 * A column header whose explanation shows on hover, keyboard focus, or tap (a tap focuses the
 * button). Escape hides it. Screen readers get the explanation via aria-describedby.
 * See docs/ux-guidelines.md.
 */
export default function HelpHeader({ label, help }: { label: string; help: string }) {
  const id = useId()
  return (
    <th scope="col">
      <span className="col-help">
        <button
          type="button"
          aria-describedby={id}
          onKeyDown={(e) => {
            if (e.key === 'Escape') e.currentTarget.blur()
          }}
        >
          {label}
        </button>
        <span role="tooltip" id={id}>
          {help}
        </span>
      </span>
    </th>
  )
}
