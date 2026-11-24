import { useEffect } from 'react'
import type { Card } from '../cards/types.ts'

const prefetched = new Set<string>()

/**
 * Warm the browser cache with these cards' images, so hovering shows them at once. Mouse
 * devices only (phones would download images that may never be looked at), when idle.
 */
export default function usePrefetchCardImages(cards: readonly Card[]) {
  const urls = cards.flatMap((c) => (c.image && !prefetched.has(c.image) ? [c.image] : []))
  const key = urls.join(' ')
  useEffect(() => {
    if (key === '' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    const run = () => {
      for (const url of key.split(' ')) {
        if (prefetched.has(url)) continue
        prefetched.add(url)
        const img = new Image()
        img.decoding = 'async'
        img.src = url
      }
    }
    // Older Safari has no requestIdleCallback.
    const idle = 'requestIdleCallback' in window
    const handle = idle ? window.requestIdleCallback(run, { timeout: 2000 }) : setTimeout(run, 500)
    return () => (idle ? window.cancelIdleCallback(handle) : clearTimeout(handle))
  }, [key])
}
