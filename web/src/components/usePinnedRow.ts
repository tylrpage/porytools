import { useCallback, useState } from 'react'

/**
 * Click or tap a table row to pin its highlight; click it again to clear, or another row to
 * move it. It's a visual reading aid (touch screens have no hover), not a control, so screen
 * readers lose nothing and the rows stay plain `<tr>`s rather than fake buttons.
 *
 * Put `ref` on an element that contains the rows (one listener for all of them), and
 * `data-row={key}` plus `className={rowClass(key)}` on each pinnable row.
 */
export function usePinnedRow() {
  const [pinned, setPinned] = useState<string | null>(null)

  // React 19 ref callbacks may return a cleanup function, run when the element goes away.
  const ref = useCallback((el: HTMLElement | null) => {
    if (!el) return
    const onClick = (e: MouseEvent) => {
      // Don't steal clicks meant for links, buttons, or text selection.
      if ((e.target as Element).closest('a, button, input, select, textarea')) return
      if (window.getSelection()?.toString()) return
      const key = (e.target as Element).closest<HTMLElement>('tr[data-row]')?.dataset.row
      if (key !== undefined) setPinned((p) => (p === key ? null : key))
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [])

  const rowClass = (key: string) => (pinned === key ? 'pinned' : undefined)
  return { ref, rowClass }
}
