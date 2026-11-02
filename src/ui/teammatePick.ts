import type { CathExpression } from '../../shared/cath/cath'
import { regionOf } from './actionLabel'
import type { Action, RegionId } from '../engine/types'

// Plan item 34: the AI teammate's pick, shown as a lifted card with its reason before it lands. The face
// they make follows the reason: a liberation delights them, a race against the next Squeeze or Expand sets
// their jaw, a quiet Graft or Sell gets a smirk, and a forced choice after a Squeeze worries them.
export function pickExpression(action: Action, reason: string): CathExpression {
  if (/^Liberating/.test(reason)) return 'delighted'
  if (/squeezed|expanded|Expand there|costs more/.test(reason)) return 'determined'
  if (action.kind === 'decide') return /Squeeze/.test(reason) ? 'worried' : 'smirk'
  if (action.kind === 'graft' || action.kind === 'sell') return 'smirk'
  if (action.kind === 'invest' || action.kind === 'role') return 'wink'
  return 'determined'
}

export function pickRegion(action: Action): RegionId | undefined {
  return regionOf(action)
}

// The lifted card flies to its hex as the pick lands, the way the player's dragged card does. A copy of the
// card is flown over the page so the Actions area can move straight on; reduced motion skips it (the card
// has already faded in, and the hex glows).
export function flyCardToHex(region: RegionId): void {
  if (typeof document === 'undefined') return
  const reduce = document.documentElement.classList.contains('reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const card = document.querySelector<HTMLElement>('.teammate-pick .teammate-card')
  const hex = document.querySelector(`.region-hex[data-region="${region}"] polygon`)
  if (reduce || !card || !hex || typeof card.animate !== 'function') return
  const from = card.getBoundingClientRect()
  const to = hex.getBoundingClientRect()
  const ghost = card.cloneNode(true) as HTMLElement
  ghost.classList.add('teammate-card-flight')
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, { position: 'fixed', left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, margin: '0', zIndex: 'var(--z-fx)', pointerEvents: 'none' })
  document.body.appendChild(ghost)
  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const anim = ghost.animate(
    [
      { transform: 'translate(0, -3px) rotate(-1.2deg) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(6deg) scale(0.22)`, opacity: 0.15 },
    ],
    { duration: 460, easing: 'cubic-bezier(.5, 0, .7, .4)', fill: 'forwards' },
  )
  anim.onfinish = () => ghost.remove()
  anim.oncancel = () => ghost.remove()
}
