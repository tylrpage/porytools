import { useEffect, useRef, useState, type RefObject } from 'react'

/** Wide windows get the log as a column; everything else gets it behind a button. The ratio
 *  is the owner's call: their roughly square desktop window (about 0.96 wide per tall) is
 *  just on the vertical side. */
const WIDE = '(min-aspect-ratio: 97/100) and (min-width: 60rem)'

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
