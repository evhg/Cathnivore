import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { DOUBT_PEEK } from './doubtPeek'

/**
 * Plan item 654: a one-line card that says what a board piece is, opened by tapping the piece, hovering it or giving it
 * keyboard focus. It reuses the glossary tooltip's look (`tooltip-popover`) and placement: portalled to <body>, hung
 * above the piece when there's room, kept 8 px inside the viewport, Escape or a tap elsewhere closes it.
 */
export default function PiecePeek({ anchor, id, onClose }: { anchor: Element; id: string; onClose: () => void }) {
  const popRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const pop = popRef.current
    if (!pop) return
    const place = () => {
      const r = anchor.getBoundingClientRect()
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
  }, [anchor])

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node
      if (!anchor.contains(t) && !popRef.current?.contains(t)) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [anchor, onClose])

  return createPortal(
    <span role="tooltip" id={id} className="tooltip-popover piece-peek" data-peek="doubt" ref={popRef}>
      <span className="tooltip-tag">
        <span className="tooltip-title">{DOUBT_PEEK.title}</span>
        {DOUBT_PEEK.body}
      </span>
    </span>,
    document.body,
  )
}
