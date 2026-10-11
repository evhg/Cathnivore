import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { GLOSSARY_LOOKUP } from '../content/terms'

interface Props {
  term: keyof typeof GLOSSARY_LOOKUP | string
  children: React.ReactNode
  // For a trigger whose visible content isn't the term itself (e.g. a standalone "?" icon next to an
  // already-interactive button), an accessible name a screen reader can announce instead of "?".
  label?: string
}

// SPEC 10.5: "Every game term ... is explained in the rules reference and in a tap or hover tooltip."
// A native `title` attribute doesn't reliably show on tap on mobile, which the spec asks for alongside
// hover, so this wraps the term in a focusable/tappable trigger with its own popover instead. Click/tap
// toggles (so it works with no pointer at all); mouse hover/focus also opens it for desktop, without
// fighting the toggle (hover-close only fires if a tap didn't leave it pinned open).
export default function Tooltip({ term, children, label }: Props) {
  const body = GLOSSARY_LOOKUP[term]
  // Two independent flags rather than one: a real mouse click also fires a `mouseenter` just before it
  // (moving the pointer onto the trigger to click it), so a single toggled flag would open on the hover
  // and immediately close again on the click that follows in the same gesture. `pinned` (tap/click) and
  // `hovering` (desktop mouse) are tracked separately and just OR'd together for visibility.
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const open = pinned || hovering
  const rootRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  // AAA UI M4: the popover is portalled to <body> and placed with position: fixed, so no scrolling
  // list, masked clipping or tilted card can clip or skew it. It hangs above its trigger when there is
  // room and below it otherwise, and is kept 8px inside the viewport. Coordinates go through
  // setProperty (CSP: no style attributes).
  useLayoutEffect(() => {
    const pop = popRef.current
    const trigger = rootRef.current
    if (!open || !pop || !trigger) return
    const place = () => {
      const r = trigger.getBoundingClientRect()
      const w = pop.offsetWidth
      const h = pop.offsetHeight
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const gap = 10
      const above = r.top - gap - h >= 8 || r.bottom + gap + h > vh - 8
      const top = above ? Math.max(8, r.top - gap - h) : r.bottom + gap
      const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), Math.max(8, vw - w - 8))
      pop.style.setProperty('--tt-x', `${Math.round(left)}px`)
      pop.style.setProperty('--tt-y', `${Math.round(top)}px`)
      pop.style.setProperty('--tt-origin', `${Math.round(r.left + r.width / 2 - left)}px ${above ? '100%' : '0'}`)
      pop.style.setProperty('--tt-arrow-x', `${Math.round(Math.min(Math.max(r.left + r.width / 2 - left - 7, 20), w - 22))}px`)
      pop.dataset.side = above ? 'above' : 'below'
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!pinned) return
    function onDocPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (rootRef.current && !rootRef.current.contains(t) && !popRef.current?.contains(t)) setPinned(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    return () => document.removeEventListener('pointerdown', onDocPointerDown)
  }, [pinned])

  // WCAG 1.4.13: Escape dismisses the popover however it was opened (tap, hover or keyboard focus).
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPinned(false)
      setHovering(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // A term with no glossary entry renders its children plain, so a typo in `term` fails loud in review
  // (an obviously-untouched label) rather than silently swallowing the tooltip.
  if (!body) return <>{children}</>

  return (
    <span
      ref={rootRef}
      className="tooltip-trigger"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        className={children === '?' ? 'tooltip-trigger-button tooltip-info' : 'tooltip-trigger-button'}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((p) => !p)
        }}
        onFocus={() => setHovering(true)}
        onBlur={() => setHovering(false)}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <span role="tooltip" id={id} className={pinned ? 'tooltip-popover' : 'tooltip-popover tooltip-popover--passive'} ref={popRef}>
            <span className="tooltip-tag">
              <span className="tooltip-title">{term}</span>
              {body}
            </span>
          </span>,
          document.body,
        )}
    </span>
  )
}
