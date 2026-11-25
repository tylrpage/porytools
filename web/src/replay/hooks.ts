import { useEffect, useRef, useState, type RefObject } from 'react'

/** Wide windows (landscape, or a half-screen window a little taller than wide) get the log as
 *  a column; everything else gets it behind a button. */
const WIDE = '(min-aspect-ratio: 4/5) and (min-width: 60rem)'

export function useWide(): boolean {
  const query = () => typeof window.matchMedia === 'function' && window.matchMedia(WIDE).matches
  const [wide, setWide] = useState(query)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(WIDE)
    const onChange = () => setWide(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return wide
}

/** A ref that always holds the latest value, for listeners added once. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
