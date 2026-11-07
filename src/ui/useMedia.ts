import { useEffect, useState } from 'react'

/**
 * Whether a media query matches, kept live (Playwright's `setViewportSize` can resize after mount). Used where a
 * part must *mount* in one place or another by viewport (one copy in the DOM, so locators and radios stay single).
 */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setOn(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return on
}
