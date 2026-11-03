// Plan item 36: where a buy's flight starts (the bought Market or Invest card) and lands (the desktop Farm
// frame, or the phone's Farm key), read from the page just before the buy changes it.
export interface BuyFlightPath {
  from: { x: number; y: number }
  to: { x: number; y: number }
  coinsAt: { x: number; y: number }
}

function centre(r: DOMRect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Plan item 62: where the bought card lands on the desktop stall: the next free crate on the producer's plank (just
 * right of the last crate, or the plank's start for a first buy). Null when the stall isn't on screen.
 */
export function stallSlotPoint(producer: string | undefined): { x: number; y: number } | null {
  if (!producer) return null
  const stall = document.querySelector(`.farm-inline .farm-stall.pc-${CSS.escape(producer)}`)
  const shelf = stall?.querySelector('.farm-stall-shelves')?.getBoundingClientRect()
  if (!stall || !shelf || shelf.width === 0) return null
  const items = stall.querySelectorAll('.stall-item')
  const last = items[items.length - 1]?.getBoundingClientRect()
  if (!last) return { x: shelf.left + 17, y: shelf.top + 11 }
  return { x: last.right + 3 + last.width / 2, y: last.top + last.height / 2 }
}

export function buyFlightPath(cardId: string, producer?: string): BuyFlightPath | null {
  if (typeof document === 'undefined') return null
  const inline = document.querySelector('.farm-inline')
  const target =
    inline && inline.getBoundingClientRect().width > 0
      ? inline
      : [...document.querySelectorAll('.rail-tab')].find((b) => /Farm/.test(b.textContent ?? '') && b.getBoundingClientRect().width > 0)
  if (!target) return null
  const to = target.getBoundingClientRect()
  const source = document.querySelector(`[data-buy-card="${CSS.escape(cardId)}"]`)?.getBoundingClientRect() ?? to
  return { from: centre(source), to: stallSlotPoint(producer) ?? centre(to), coinsAt: { x: source.left + source.width / 2, y: source.top } }
}

export function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
