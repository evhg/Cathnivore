import { useEffect, useRef } from 'react'

/**
 * Plan item 33: a phone sheet (Farm, Market, Cath's Plan, Log) closes on Escape like every other overlay, takes
 * focus when it opens (its Close button) and hands it back to whatever opened it when it closes. Off for the
 * inline desktop panels, which aren't overlays.
 */
export function useSheetDismiss(onClose: () => void, enabled = true) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!enabled) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    ref.current?.querySelector<HTMLElement>('header button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      e.preventDefault()
      close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [enabled])
  return ref
}
