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
      const minY = s.top - f.top + 8
      const maxY = s.bottom - f.top - h - 8
      // Plan item 666: centred on its stop the ticket hid the region names around it (chapter 1's covered Oakvale's
      // and Shingle Bay's): try it level, raised and lowered on each side the sheet has room for, and keep the place
      // that covers least of the names and the other stops (ties go to the old one: level, left of the stop).
      type Rect = { l: number; t: number; r: number; b: number }
      const rects = (sel: string): Rect[] =>
        [...fig.querySelectorAll(sel)]
          .filter((e) => e !== disc)
          .map((e) => e.getBoundingClientRect())
          .map((r) => ({ l: r.left - f.left, t: r.top - f.top, r: r.right - f.left, b: r.bottom - f.top }))
      const names = rects('.cmp-map-name')
      const pics = rects('.cmp-landmark, .cmp-tower')
      // Plan item 732: the atlas's own marks (the compass rose, the cartouche) are kept clear like a stop: at D chapter 1's
      // ticket sat over the compass and Oakvale's corner.
      const marks = rects('.cmp-compass, .cmp-cartouche')
      // the ticket is turned 1 degree: its corners reach about 4 px past its box
      const over = (list: Rect[], x: number, y: number) =>
        list.reduce((a, k) => a + Math.max(0, Math.min(x + w + 4, k.r) - Math.max(x - 4, k.l)) * Math.max(0, Math.min(y + h + 4, k.b) - Math.max(y - 4, k.t)), 0)
      // Beside the stop on either side (level, raised, lowered), or above or below it.
      const clampX = (x: number) => Math.min(Math.max(x, minX), maxX - w)
      const clampY = (y: number) => Math.min(Math.max(y, minY), maxY)
      const spots: Array<{ x: number; y: number }> = []
      for (const x of [px - GAP - w, px + GAP]) {
        if (x < minX || x + w > maxX) continue
        for (const dy of [0, -0.4, 0.4, -0.75, 0.75]) spots.push({ x, y: clampY(py - h / 2 + dy * h) })
      }
      for (const y of [py + GAP * 0.6, py - GAP * 0.6 - h]) {
        if (y < minY || y > maxY) continue
        for (const x of [px - w / 2, px - w + 48, px - 48]) spots.push({ x: clampX(x), y })
      }
      if (!spots.length) spots.push({ x: clampX(px - GAP - w), y: clampY(py - h / 2) })
      const near = (x: number, y: number) => Math.hypot(Math.max(x - px, 0, px - x - w), Math.max(y - py, 0, py - y - h))
      // Plan items 669 and 682: one search over the places beside, above and below the stop and every place on the
      // sheet (a 12 px grid). Covering a region name costs most, then the leader line crossing a name, then covering
      // another stop, then the map's pictures (landmarks, towers), then distance. At D chapter 1's ticket sat on
      // stop 6 and Kingsmarket's landmark, and a far place ran its leader through 'Brindle Hills'.
      const stops = rects('.cmp-pin-disc')
      const own = d
      const hitsOwn = (x: number, y: number) => x < own.right - f.left + 4 && own.left - f.left - 4 < x + w && y < own.bottom - f.top + 4 && own.top - f.top - 4 < y + h
      const leadCrosses = (x: number, y: number) => {
        const ex = Math.min(Math.max(px, x), x + w)
        const ey = Math.min(Math.max(py, y), y + h)
        for (let i = 1; i < 16; i++) {
          const qx = px + ((ex - px) * i) / 16
          const qy = py + ((ey - py) * i) / 16
          if (names.some((k) => qx > k.l && qx < k.r && qy > k.t && qy < k.b)) return true
        }
        return false
      }
      for (let y = minY; y <= maxY; y += 12) for (let x = minX; x + w <= maxX; x += 12) spots.push({ x, y })
      const cost = (x: number, y: number) =>
        (hitsOwn(x, y) ? 1e12 : 0) + 1e6 * over(names, x, y) + 1e3 * over(stops, x, y) + 1e3 * over(marks, x, y) + (leadCrosses(x, y) ? 1e6 : 0) + over(pics, x, y) + near(x, y) * 40
      let best = spots[0]!
      let score = Infinity
      for (const sp of spots) {
        const sc = cost(sp.x, sp.y)
        if (sc < score) [best, score] = [sp, sc]
      }
      const left = best.x
      const top = best.y
      // the leader meets the ticket's edge nearest the stop
      const ex = Math.min(Math.max(px, left + 18), left + w - 18)
      const ey = Math.min(Math.max(py, top + 18), top + h - 18)
      const side = px < left ? 'l' : px > left + w ? 'r' : py < top ? 't' : 'b'
      const exx = side === 'l' ? left : side === 'r' ? left + w : ex
      const eyy = side === 't' ? top : side === 'b' ? top + h : ey
      setPlace({ left, top, px, py, ex: exx, ey: eyy })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(fig)
    // Plan item 682: and when the ticket's own size settles (fonts, the goal's wrap): placed from its first size it
    // sat over Oakvale's name.
    ro.observe(el)
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
      {/* Plan item 669: keyed by chapter, so each chapter chosen unfolds afresh from its pin (`cmp-ticket-unfold`) */}
      <div
        key={chapter.id}
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
