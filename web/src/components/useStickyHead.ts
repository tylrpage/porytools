import { useCallback } from 'react'

/**
 * Lets a table's header row stick to the top of the window (`.table-scroll.sticky-head` in
 * index.css), falling back to sideways scrolling when the table is too wide for its box.
 *
 * `position: sticky` sticks to the nearest scrolling box. A `.table-scroll` that can scroll
 * sideways is one, even when it never moves, so the header would stick inside it, not to the
 * window. So the box only scrolls when it must: this hook sets `data-overflows` on it when the
 * table is wider than it, and the CSS turns sideways scrolling on (and sticking off) then.
 * It only re-measures when a size changes, never while scrolling, so the browser does the
 * sticking itself with no lag.
 *
 * Put `ref` on the `.table-scroll` element.
 */
export function useStickyHead() {
  return useCallback((box: HTMLElement | null) => {
    const table = box?.querySelector('table')
    if (!box || !table) return
    const update = () => {
      // An attribute rather than a class, so React re-rendering className can't wipe it.
      box.toggleAttribute('data-overflows', table.offsetWidth > box.clientWidth + 1)
    }
    update()
    // Test DOMs lack ResizeObserver, hence the `?.`.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resize?.observe(box)
    resize?.observe(table)
    return () => resize?.disconnect()
  }, [])
}
