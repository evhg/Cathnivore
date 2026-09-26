import { useEffect, useId, useRef, useState } from 'react'
import { GLOSSARY_LOOKUP } from '../content/terms'

interface Props {
  term: keyof typeof GLOSSARY_LOOKUP | string
  children: React.ReactNode
}

// SPEC 10.5: "Every game term ... is explained in the rules reference and in a tap or hover tooltip."
// A native `title` attribute doesn't reliably show on tap on mobile, which the spec asks for alongside
// hover, so this wraps the term in a focusable/tappable trigger with its own popover instead. Click/tap
// toggles (so it works with no pointer at all); mouse hover/focus also opens it for desktop, without
// fighting the toggle (hover-close only fires if a tap didn't leave it pinned open).
export default function Tooltip({ term, children }: Props) {
  const body = GLOSSARY_LOOKUP[term]
  // Two independent flags rather than one: a real mouse click also fires a `mouseenter` just before it
  // (moving the pointer onto the trigger to click it), so a single toggled flag would open on the hover
  // and immediately close again on the click that follows in the same gesture. `pinned` (tap/click) and
  // `hovering` (desktop mouse) are tracked separately and just OR'd together for visibility.
  const [pinned, setPinned] = useState(false)
  const [hovering, setHovering] = useState(false)
  const open = pinned || hovering
  const rootRef = useRef<HTMLSpanElement>(null)
  const id = useId()

  useEffect(() => {
    if (!pinned) return
    function onDocPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', onDocPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pinned])

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
        className="tooltip-trigger-button"
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
      {open && (
        <span role="tooltip" id={id} className="tooltip-popover">
          {body}
        </span>
      )}
    </span>
  )
}
