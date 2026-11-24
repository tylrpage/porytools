import { useCallback } from 'react'

/**
 * Keeps a table's header row at the top of the window while any of the table is in view.
 *
 * Plain `position: sticky; top: 0` can't do this here: the table sits in a `.table-scroll`
 * box (`overflow-x: auto`) so it can scroll sideways on a phone, and a scroll container is
 * what sticky sticks to. So we slide the header down with a CSS variable instead, read by
 * `translate` on the header cells (see index.css), clamped so it never leaves the table.
 *
 * Put `ref` on the `<thead>`.
 */
export function useStickyHead() {
  return useCallback((head: HTMLTableSectionElement | null) => {
    const table = head?.closest('table')
    if (!head || !table) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = table.getBoundingClientRect().top
      const max = table.offsetHeight - head.offsetHeight
      const y = Math.min(Math.max(-top, 0), Math.max(max, 0))
      head.style.setProperty('--head-y', `${y}px`)
    }
    // At most one update per frame, however many scroll events arrive.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // The table grows or shrinks when the deck changes, without any scroll. (Test DOMs lack
    // ResizeObserver, hence the `?.`.)
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    resize?.observe(table)
    update()
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      resize?.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])
}
