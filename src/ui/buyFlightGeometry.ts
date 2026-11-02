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

export function buyFlightPath(cardId: string): BuyFlightPath | null {
  if (typeof document === 'undefined') return null
  const inline = document.querySelector('.farm-inline')
  const target =
    inline && inline.getBoundingClientRect().width > 0
      ? inline
      : [...document.querySelectorAll('.rail-tab')].find((b) => /Farm/.test(b.textContent ?? '') && b.getBoundingClientRect().width > 0)
  if (!target) return null
  const to = target.getBoundingClientRect()
  const source = document.querySelector(`[data-buy-card="${CSS.escape(cardId)}"]`)?.getBoundingClientRect() ?? to
  return { from: centre(source), to: centre(to), coinsAt: { x: source.left + source.width / 2, y: source.top } }
}

export function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
