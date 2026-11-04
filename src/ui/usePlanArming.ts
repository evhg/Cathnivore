import { useEffect, useRef } from 'react'

// Plan item 100: when Hollowell's conveyor moves a new card into a slot, that card slides in from the right
// (the way the conveyor runs, Scout -> Expand -> Squeeze) and stamps down: a hard settle with no overshoot,
// because corporations don't bounce. Reduced motion (the OS or the game's setting) gets a plain fade.

export const ARM_SLIDE_MS = 420

function reduced(): boolean {
  if (document.documentElement.classList.contains('reduce-motion')) return true
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** `ids` is each slot's card id (or '' when empty), in the strip's order. */
export function usePlanArming(ids: readonly string[]) {
  const ref = useRef<HTMLElement>(null)
  const prev = useRef<readonly string[] | null>(null)
  const key = ids.join('|')
  useEffect(() => {
    const before = prev.current
    prev.current = ids
    const root = ref.current
    if (!before || !root || typeof Element.prototype.animate !== 'function') return
    const cards = root.querySelectorAll<HTMLElement>('.plan-strip-item > button:first-child')
    let order = 0
    ids.forEach((id, i) => {
      const card = cards[i]
      if (!card || !id || id === before[i]) return
      card.dataset.arming = ''
      const delay = order++ * 90
      const anim = reduced()
        ? card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay, fill: 'backwards' })
        : card.animate(
            [
              { transform: 'translateX(28px) scale(1.06)', opacity: 0, offset: 0 },
              { transform: 'translateX(0) scale(1.06)', opacity: 1, offset: 0.62 },
              { transform: 'translateX(0) scale(1)', opacity: 1, offset: 1 },
            ],
            { duration: ARM_SLIDE_MS, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
          )
      anim.onfinish = anim.oncancel = () => delete card.dataset.arming
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return ref
}
