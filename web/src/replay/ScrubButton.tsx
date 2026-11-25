import type { ReactNode } from 'react'

/**
 * A playback button whose name and keyboard shortcut show above it on hover or keyboard
 * focus (the shortcut muted). Screen readers get the name from aria-label and the shortcut
 * from aria-keyshortcuts, so the tooltip itself is hidden from them.
 */
export default function ScrubButton({
  label,
  keys,
  shortcut,
  onClick,
  disabled,
  children,
}: {
  label: string
  /** The shortcut as shown, e.g. "Shift + →". */
  keys?: string
  /** The shortcut in aria-keyshortcuts form, e.g. "Shift+ArrowRight". */
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <span className="scrub">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-keyshortcuts={shortcut}
      >
        {children}
      </button>
      <span className="scrub-tip" aria-hidden="true">
        {label}
        {keys && <span className="muted"> {keys}</span>}
      </span>
    </span>
  )
}
