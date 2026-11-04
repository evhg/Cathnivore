import { reducedMotion } from './buyFlightGeometry'

// Plan item 83: playing an action card lifts it off the hand and sets it down toward the board: on the hex it
// was played on, or the board's middle for a card with no region. 250 ms; under reduced motion it fades in
// place. The flying copy is the card's own face with its computed styles inlined, in a fixed layer that takes
// no pointer events and is hidden from assistive tech; it carries no classes, so nothing that looks for
// `.action-item` (layout, the tutorial, e2e) ever sees it.

/** Pure: the lift's keyframes from a card's box to a target point (viewport px). */
export function liftKeyframes(from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number } | null, still: boolean): Keyframe[] {
  if (still || !to) {
    return [
      { transform: 'translate(0, 0)', opacity: 1 },
      { transform: 'translate(0, -4px)', opacity: 0 },
    ]
  }
  const dx = to.x - (from.x + from.width / 2)
  const dy = to.y - (from.y + from.height / 2)
  return [
    { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1, boxShadow: '0 2px 4px rgba(0,0,0,.15)' },
    { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 18}px) scale(1.06) rotate(-2deg)`, opacity: 1, offset: 0.35, boxShadow: '0 14px 24px rgba(0,0,0,.25)' },
    { transform: `translate(${dx}px, ${dy}px) scale(.42) rotate(1deg)`, opacity: 0, boxShadow: '0 1px 2px rgba(0,0,0,.1)' },
  ]
}

function inlineStyles(src: Element, dst: Element): void {
  const cs = getComputedStyle(src)
  const style = (dst as HTMLElement | SVGElement).style
  for (let i = 0; i < cs.length; i++) {
    const p = cs[i]!
    style.setProperty(p, cs.getPropertyValue(p))
  }
  const a = src.children
  const b = dst.children
  for (let i = 0; i < a.length && i < b.length; i++) inlineStyles(a[i]!, b[i]!)
}

function strip(el: Element): void {
  el.removeAttribute('class')
  el.removeAttribute('id')
  el.removeAttribute('aria-label')
  el.removeAttribute('title')
  for (const name of el.getAttributeNames()) if (name.startsWith('data-')) el.removeAttribute(name)
  for (const c of el.children) strip(c)
}

/** Where a played card goes: its region's hex, else the board's middle. */
export function liftTarget(region: string | undefined): { x: number; y: number } | null {
  const hex = region ? document.querySelector(`.region-hex[data-tutorial="region-${region}"]`) : null
  const box = (hex ?? document.querySelector('.map-wrap'))?.getBoundingClientRect()
  if (!box || box.width === 0) return null
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

/** Fly a copy of `card` (an action card's button) to `to`. Returns the animation, or null if it can't run. */
export function liftPlayedCard(card: HTMLElement, to: { x: number; y: number } | null): Animation | null {
  if (!card.isConnected || typeof card.animate !== 'function') return null
  const box = card.getBoundingClientRect()
  if (box.width === 0 || box.height === 0) return null
  const copy = card.cloneNode(true) as HTMLElement
  inlineStyles(card, copy)
  strip(copy)
  const layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.setAttribute('inert', '')
  layer.className = 'play-lift'
  Object.assign(layer.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` })
  Object.assign(copy.style, { position: 'static', margin: '0', width: '100%', height: '100%', translate: 'none', rotate: 'none', transform: 'none' })
  layer.appendChild(copy)
  document.body.appendChild(layer)
  const anim = layer.animate(liftKeyframes(box, to, reducedMotion()), { duration: 250, easing: 'cubic-bezier(.3, 0, .5, 1)', fill: 'forwards' })
  const done = () => layer.remove()
  anim.onfinish = done
  anim.oncancel = done
  return anim
}

/** The lift runs for players; under webdriver only with `?lift`, so specs that click card after card keep their timing. */
export function liftEnabled(): boolean {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return typeof location !== 'undefined' && new URLSearchParams(location.search).has('lift')
  return true
}
