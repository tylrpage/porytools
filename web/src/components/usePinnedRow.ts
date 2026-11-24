import { useCallback, useState } from 'react'

/**
 * Click or tap a table row to pin its highlight; click it again or anywhere off the rows (or
 * press Escape) to clear, or another row to move it. It's a visual reading aid (touch screens have no hover), not a control, so screen
 * readers lose nothing and the rows stay plain `<tr>`s rather than fake buttons.
 *
 * Put `ref` on an element that contains the rows, and `data-row={key}` plus
 * `className={rowClass(key)}` on each pinnable row.
 */
export function usePinnedRow() {
  const [pinned, setPinned] = useState<string | null>(null)

  // React 19 ref callbacks may return a cleanup function, run when the element goes away.
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    // Listen on the whole document so a click off the rows can clear the pin. (iOS still
    // delivers these: React's own listener on the app root makes every element "clickable".)
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element
      const row = target.closest<HTMLElement>('tr[data-row]')
      if (!row || !el.contains(row)) return setPinned(null)
      // Inside a row, don't steal clicks meant for links, buttons, or text selection.
      if (target.closest('a, button, input, select, textarea')) return
      if (window.getSelection()?.toString()) return
      const key = row.dataset.row
      if (key !== undefined) setPinned((p) => (p === key ? null : key))
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(null)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const rowClass = (key: string) => (pinned === key ? 'pinned' : undefined)
  return { ref, rowClass }
}
