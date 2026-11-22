import { useLayoutEffect, useRef, useState } from 'react'
import type { Chapter } from '../content/chapters'

// Plan item 659: at a desktop the chosen chapter (the one pointed at in the rail or on the map, else the next to play)
// is a ticket pinned on the atlas beside its numbered stop, a leader line from the stop to the ticket's edge: its
// number, name, goal and Play, so the map and the chapter read as one scene. The rail stays the list of chapters.
// Test hooks: `.cmp-ticket[data-chapter]`, `.cmp-ticket-lead`.
const GAP = 58

type Place = { left: number; top: number; px: number; py: number; ex: number; ey: number }

export default function CampaignTicket({
  chapter,
  index,
  state,
  onStart,
  onHold,
}: {
  chapter: Chapter
  index: number
  state: 'done' | 'current' | 'locked'
  onStart(chapter: Chapter): void
  /** The pointer rests on the ticket: hold it where it is while the player reaches for Play. */
  onHold(held: boolean): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<Place | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    const fig = el?.closest('.cmp-map') as HTMLElement | null
    if (!el || !fig) return
    const measure = () => {
      const disc = fig.querySelector(`.cmp-pin[data-chapter="${chapter.id}"] .cmp-pin-disc`)
      const svg = fig.querySelector('.cmp-map-svg')
      if (!disc || !svg) return
      const f = fig.getBoundingClientRect()
      const d = disc.getBoundingClientRect()
      const s = svg.getBoundingClientRect()
      const px = d.left + d.width / 2 - f.left
      const py = d.top + d.height / 2 - f.top
      const w = el.offsetWidth
      const h = el.offsetHeight
      // Left of the stop when the sheet has room there, else right of it, short of Cath and her line at the sheet's
      // right; never past the sheet's edges.
      const host = fig.querySelector('.cmp-map-host')?.getBoundingClientRect()
      const minX = s.left - f.left + 8
      const maxX = Math.min(s.right, host ? host.left : s.right) - f.left - 8
      const right = px - GAP - w < minX && px + GAP + w <= maxX
      const left = right ? px + GAP : Math.max(minX, px - GAP - w)
      const top = Math.min(Math.max(py - h / 2, s.top - f.top + 8), s.bottom - f.top - h - 8)
      const ex = right ? left : left + w
      const ey = Math.min(Math.max(py, top + 18), top + h - 18)
      setPlace({ left, top, px, py, ex, ey })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(fig)
    return () => ro.disconnect()
  }, [chapter.id])
  const locked = state === 'locked'
  return (
    <>
      {place && (
        <svg className="cmp-ticket-lead" aria-hidden="true">
          <line x1={place.px} y1={place.py} x2={place.ex} y2={place.ey} />
          <circle cx={place.ex} cy={place.ey} r={4} />
        </svg>
      )}
      <div
        ref={ref}
        className={`cmp-ticket cmp-ticket-${state}`}
        data-chapter={chapter.id}
        style={place ? { left: place.left, top: place.top } : { visibility: 'hidden' }}
        onPointerEnter={() => onHold(true)}
        onPointerLeave={() => onHold(false)}
      >
        <span className="cmp-ticket-pin" aria-hidden="true" />
        <span className="cmp-ticket-no">Chapter {index + 1}</span>
        <strong className="cmp-ticket-title">{chapter.title}</strong>
        <span className="cmp-ticket-goal">{(locked && chapter.goalShort) || chapter.goalDescription}</span>
        {locked ? (
          <span className="cmp-ticket-sealed">Win chapter {index} to open</span>
        ) : (
          <button type="button" className="cmp-ticket-play" onClick={() => onStart(chapter)} aria-label={`Chapter ${index + 1}, ${chapter.title}: ${state === 'done' ? 'replay' : 'play'}`}>
            {state === 'done' ? 'Play again' : 'Play'}
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M5 3l5 5-5 5" />
            </svg>
          </button>
        )}
      </div>
    </>
  )
}
