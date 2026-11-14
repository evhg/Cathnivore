import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import { CHAPTER_HOMES, MAP_AXIAL, currentChapterIndex, liberatedRegions } from '../content/campaignMap'
import { BUNTING, CATH_SIZE, LANDMARK_SCALE, LANDMARKS, cathBox, MAP_FACE_R, MAP_R, landmarkAt, nameBaseline, nameLines, pinCentre, postAt, regionCentre, riverPath } from '../content/campaignMapLayout'
import { BOARD_FACE_R, GroundArt } from './Map'
import type { RegionId } from '../engine/types'
import { Landmark } from './Landmark'
import { cathSvg } from '../../shared/cath/cath'

// Plan item 35: the Republic of Marrow, drawn in code, as the campaign's map. Regions held by Hollowell
// are orange; a won chapter frees its home regions (green, with bunting). Each chapter is a numbered pin
// on a dotted lane, and Cath stands at the one that's next. The chapter cards below stay the accessible
// way in (each is a real button); the pins are a pointer shortcut to the same thing.
//
// Test hooks: each region is `[data-region]` with `data-liberated="true"` once freed; Cath is
// `.cmp-map-cath` with `data-at` naming the chapter she stands at.

const R = MAP_R

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

const centre = regionCentre

function pinOf(chapter: Chapter): { x: number; y: number } {
  return pinCentre(CHAPTER_HOMES[chapter.id]?.[0] ?? chapter.activeRegions[0]!)
}

// Plan item 248: a region Hollowell still holds carries one of its outlets, a grey box with an orange fascia and a
// dark door; a freed region has a market stall in its place, striped awning and produce on the counter. Both fit
// the old sign post's box (postBox: 14 x 18 units), so the layout test's clearances still hold.
function Outlet() {
  return (
    <g className="cmp-outlet" aria-hidden="true">
      <path d="M-6.5 2 V-9 H6.5 V2 Z" className="cmp-outlet-wall" />
      <path d="M-7 -9 H7 V-14 H-7 Z" className="cmp-outlet-fascia" />
      <path d="M-4.5 -11.5 H4.5" className="cmp-outlet-sign" />
      <path d="M-2 2 V-5 H2 V2 Z" className="cmp-outlet-door" />
      <path d="M-5.5 -7 H-3.2 V-4.4 H-5.5 Z M3.2 -7 H5.5 V-4.4 H3.2 Z" className="cmp-outlet-window" />
    </g>
  )
}

function Stall() {
  return (
    <g className="cmp-stall" aria-hidden="true">
      <path d="M-6 -9 V2 M6 -9 V2" className="cmp-stall-post" />
      <path d="M-7 -9 H7 L6 -15 H-6 Z" className="cmp-stall-awning" />
      <path d="M-3.5 -15 L-4.2 -9 H-1.4 L-1.2 -15 Z M1.2 -15 L1.4 -9 H4.2 L3.5 -15 Z" className="cmp-stall-stripe" />
      <path d="M-6.5 -3 H6.5 V1 H-6.5 Z" className="cmp-stall-counter" />
      <circle cx={-3.6} cy={-4.2} r={1.5} className="cmp-stall-produce" />
      <circle cx={0} cy={-4.4} r={1.6} className="cmp-stall-produce is-b" />
      <circle cx={3.6} cy={-4.2} r={1.5} className="cmp-stall-produce" />
    </g>
  )
}

// Little wave marks in the sea round the island (clear of the coast).
const WAVES: [number, number][] = [[-150, -120], [-128, -96], [118, -128], [140, -104], [-152, 96], [-130, 122], [128, 118], [-60, 138], [36, -146]]

const GROUND_SCALE = MAP_FACE_R / BOARD_FACE_R

// A swag of pennants across a freed hex's upper edge.
function Bunting() {
  const flags = 5
  const span = BUNTING.halfSpan * 2
  const x0 = -span / 2
  const top = BUNTING.top
  const sag = (t: number) => top + Math.sin(t * Math.PI) * 5
  return (
    <g className="cmp-bunting" aria-hidden="true">
      <path d={`M${x0} ${sag(0)} Q0 ${top + 10} ${-x0} ${sag(1)}`} className="cmp-bunting-line" />
      {Array.from({ length: flags }, (_, i) => {
        const t = (i + 0.5) / flags
        const x = x0 + span * t
        const y = sag(t)
        return <path key={i} d={`M${x - 5} ${y} L${x + 5} ${y} L${x} ${y + 9} Z`} className={`cmp-flag cmp-flag-${i % 3}`} />
      })}
    </g>
  )
}

// Plan item 279: Hollowell's signage over the land it still holds: its orange-and-white tape strung taut across
// the hex's upper edge (where a freed region's bunting hangs), three branded placards on it. Freeing the region
// takes the tape down and the bunting goes up in its place.
function HollowellTape() {
  const x0 = -BUNTING.halfSpan
  const y = BUNTING.top - 1
  const placards = [-0.55, 0, 0.55].map((t) => t * BUNTING.halfSpan)
  return (
    <g className="cmp-tape" aria-hidden="true">
      <path d={`M${x0} ${y} Q0 ${y + 3} ${-x0} ${y}`} className="cmp-tape-band" />
      <path d={`M${x0} ${y} Q0 ${y + 3} ${-x0} ${y}`} className="cmp-tape-stripe" />
      {placards.map((x) => (
        <g key={x} transform={`translate(${x.toFixed(1)} ${(y + 0.5 + (1 - (x / BUNTING.halfSpan) ** 2) * 1.5).toFixed(1)})`}>
          <rect x={-4.5} y={0} width={9} height={7} rx={1.3} className="cmp-tape-card" />
          <path d="M-2 1.7 V5.3 M2 1.7 V5.3 M-2 3.5 H2" className="cmp-tape-h" />
        </g>
      ))}
    </g>
  )
}

// The chapter-complete moment (plan item 35), in phases: 'before' (the chapter's regions still held, Cath
// at its pin), 'flood' (they turn green and the bunting drops), 'walk' (Cath walks to the next pin and
// the next chapter's caption slides in), then 'done'. Reduced motion fades between the same states.
type Phase = 'before' | 'flood' | 'walk' | 'done'
const PHASE_MS: Record<Exclude<Phase, 'done'>, number> = { before: 450, flood: 1100, walk: 1400 }

function useCelebration(celebrate: string | undefined): Phase {
  const [phase, setPhase] = useState<Phase>(celebrate ? 'before' : 'done')
  useEffect(() => {
    if (!celebrate || phase === 'done') return
    const next: Record<Exclude<Phase, 'done'>, Phase> = { before: 'flood', flood: 'walk', walk: 'done' }
    const t = setTimeout(() => setPhase(next[phase]), PHASE_MS[phase])
    return () => clearTimeout(t)
  }, [celebrate, phase])
  return phase
}

export default function CampaignMap({
  chapters,
  completed: savedCompleted,
  onStart,
  celebrate,
  lit,
  host,
  onPick,
  picked,
}: {
  chapters: Chapter[]
  completed: string[]
  onStart(chapter: Chapter): void
  celebrate?: string
  /** Plan item 113: the chapter under the pointer or focus in the list; its home regions glow (`data-lit`). */
  lit?: string
  /** Plan item 248: on a desktop, Cath's full-length host figure stands in the map's sea beside the island. */
  host?: ReactNode
  /** Plan item 386: on a phone a stop opens its chapter in the sheet under the map instead of starting it. */
  onPick?(chapter: Chapter): void
  /** Plan item 386: the chapter open in the phone's sheet; its stop wears a ring. */
  picked?: string
}) {
  const phase = useCelebration(celebrate && savedCompleted.includes(celebrate) ? celebrate : undefined)
  // Until the flood, the chapter just won still reads as not won; Cath waits at its pin until she walks.
  const completed = phase === 'before' ? savedCompleted.filter((id) => id !== celebrate) : savedCompleted
  const walked = phase === 'before' || phase === 'flood' ? savedCompleted.filter((id) => id !== celebrate) : savedCompleted
  const free = liberatedRegions(completed)
  const here = currentChapterIndex(
    chapters.map((c) => c.id),
    walked,
  )
  const allDone = chapters.every((c) => walked.includes(c.id))
  const flooding = celebrate && phase !== 'done' ? new Set(CHAPTER_HOMES[celebrate] ?? []) : new Set<RegionId>()
  const herChapter = chapters[here]!
  const herPin = pinOf(herChapter)
  const herHome = CHAPTER_HOMES[herChapter.id]?.[0]
  const regionIds = Object.keys(MAP_AXIAL) as RegionId[]
  const nextHomes = new Set(allDone ? [] : (CHAPTER_HOMES[herChapter.id] ?? []))
  const litHomes = new Set(lit ? (CHAPTER_HOMES[lit] ?? []) : [])
  // Plan item 373: on a desktop the large presenter stands beside the map, so her marker on it is a small leaf pin
  // (one Cath on the screen). Plan item 386: the phone too, where she presents from the header.
  const cath = useMemo(
    () =>
      host || onPick
        ? `<svg width="${CATH_SIZE.w}" height="${CATH_SIZE.h}" viewBox="0 0 28 42" class="cmp-leaf-pin" data-cath-marker=""><ellipse cx="10" cy="33" rx="5" ry="1.6" class="cmp-leaf-shadow"/><path d="M10 32 C4.5 24 2 19.5 2 14 A8 8 0 0 1 18 14 C18 19.5 15.5 24 10 32 Z" class="cmp-leaf-body"/><path d="M10 8.5 C6.6 10.8 6.6 16 10 18.8 C13.4 16 13.4 10.8 10 8.5 Z" class="cmp-leaf-leaf"/><path d="M10 10 V18" class="cmp-leaf-vein"/></svg>`
        : cathSvg({ framing: 'half', pose: allDone ? 'cheer' : 'wave', expression: allDone ? 'delighted' : 'smirk', width: CATH_SIZE.w, height: CATH_SIZE.h, animate: true }),
    [allDone, host, onPick],
  )
  const pins = chapters.map(pinOf)
  // Plan item 386: the stops' hit circles are 44 px across whatever the map's drawn scale (its viewBox is 320 wide),
  // capped so neighbouring stops don't swallow each other.
  const svgRef = useRef<SVGSVGElement>(null)
  const [hitR, setHitR] = useState(21)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !onPick || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const scale = Math.min(svg.clientWidth / 320, svg.clientHeight / 296)
      if (scale > 0) setHitR(Math.min(36, Math.max(21, 22.5 / scale)))
    })
    ro.observe(svg)
    return () => ro.disconnect()
  }, [onPick])
  // The lane: a gentle curve from each pin to the next.
  const lane = pins
    .map((p, i) => {
      if (i === 0) return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}`
      const a = pins[i - 1]!
      const mx = (a.x + p.x) / 2 + (p.y - a.y) * 0.18
      const my = (a.y + p.y) / 2 - (p.x - a.x) * 0.18
      return `Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' ')
  // Plan item 279: the lane is a sandy road with the chapter path inked along it; the stretches Cath has
  // already walked (from a won chapter's pin to the next) are inked solid in the co-op's green.
  const legs = pins.slice(1).map((p, j) => {
    const a = pins[j]!
    const mx = (a.x + p.x) / 2 + (p.y - a.y) * 0.18
    const my = (a.y + p.y) / 2 - (p.x - a.x) * 0.18
    return { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, walked: walked.includes(chapters[j]!.id) }
  })
  const freedCount = free.size
  const label = allDone
    ? 'Map of Marrow: every region liberated.'
    : `Map of Marrow: ${freedCount} of 7 regions liberated. Next: chapter ${here + 1}, ${herChapter.title}.`

  return (
    <figure className="cmp-map" data-free={freedCount} data-phase={phase}>
      <svg ref={svgRef} className="cmp-map-svg" viewBox="-160 -150 320 296" role="img" aria-label={label}>
        <defs>
          <pattern id="cmp-hold-hatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <line x1={0} y1={0} x2={0} y2={6} className="cmp-hold-line" />
          </pattern>
        </defs>
        {/* Plan item 49: Marrow is an island. The coast is every hex grown outward and merged (round joins
            soften it): first the surf, then the sand. */}
        <g className="cmp-map-waves" aria-hidden="true">
          {WAVES.map(([x, y]) => (
            <path key={`${x}${y}`} d={`M${x} ${y} q3 -3 6 0 t6 0`} />
          ))}
        </g>
        <g className="cmp-map-coast-surf" aria-hidden="true">
          {regionIds.map((id) => {
            const c = centre(id)
            return <polygon key={id} points={hexPoints(R * 1.16)} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`} />
          })}
        </g>
        <g className="cmp-map-coast-sand" aria-hidden="true">
          {regionIds.map((id) => {
            const c = centre(id)
            return <polygon key={id} points={hexPoints(R * 1.06)} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`} />
          })}
        </g>
        {regionIds.map((id) => {
          const c = centre(id)
          const isFree = free.has(id)
          const type = REGIONS[id].type
          const cls = `cmp-map-hex cmp-map-${type} ${isFree ? 'is-free' : 'is-held'}${nextHomes.has(id) ? ' is-next' : ''}${flooding.has(id) ? ' is-flooding' : ''}`
          // Plan item 248: freed (full colour, a market), current (the next chapter's home), locked (Hollowell's grey).
          const state = isFree ? 'freed' : nextHomes.has(id) ? 'current' : 'locked'
          return (
            <g key={id} data-region={id} data-state={state} data-liberated={isFree ? 'true' : 'false'} data-lit={litHomes.has(id) ? 'true' : undefined} className={cls} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
              <polygon points={hexPoints(MAP_FACE_R)} className="cmp-map-ground" />
              {/* The board's own painted ground for this region type, scaled down to the map's hex. */}
              <g transform={`scale(${GROUND_SCALE.toFixed(4)})`} className="cmp-map-paint">
                <GroundArt type={type} id={id} clip={`cmp-ground-${id}`} />
              </g>
              <polygon points={hexPoints(MAP_FACE_R)} className="cmp-map-tint" />
              <polygon points={hexPoints(MAP_FACE_R)} className="cmp-map-hatch" fill="url(#cmp-hold-hatch)" />
            </g>
          )
        })}
        <g className="cmp-map-river" aria-hidden="true">
          <path d={riverPath()} className="cmp-river-bank" />
          <path d={riverPath()} className="cmp-river-water" />
        </g>
        <path d={lane} className="cmp-map-road" aria-hidden="true" />
        {/* Plan item 373: the route's dots run bright up to the open stop and dim after it. */}
        <g className="cmp-map-lane" aria-hidden="true">
          {legs.map((leg, j) => (
            <path key={j} d={leg.d} className={j >= here ? 'is-ahead' : undefined} />
          ))}
        </g>
        <g className="cmp-map-trail" aria-hidden="true">
          {legs.map((leg, j) => (leg.walked ? <path key={j} d={leg.d} data-leg={j} /> : null))}
        </g>
        {regionIds.map((id) => {
          const c = centre(id)
          const isFree = free.has(id)
          const lm = landmarkAt(id)
          const post = postAt(id)
          const showPost = !isFree && id !== herHome
          return (
            <g key={id} className={`cmp-map-dress ${isFree ? 'is-free' : 'is-held'}${flooding.has(id) ? ' is-flooding' : ''}`} aria-hidden="true">
              <g transform={`translate(${lm.x.toFixed(1)} ${lm.y.toFixed(1)}) scale(${LANDMARK_SCALE})`} className="cmp-landmark" data-landmark={LANDMARKS[id]!.kind}>
                <Landmark kind={LANDMARKS[id]!.kind} />
              </g>
              {(showPost || isFree) && (
                <g transform={`translate(${post.x.toFixed(1)} ${post.y.toFixed(1)})`} data-building={isFree ? 'stall' : 'outlet'}>
                  {isFree ? <Stall /> : <Outlet />}
                </g>
              )}
              <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>{isFree ? <Bunting /> : <HollowellTape />}</g>
              {/* Plan item 47: a two-word name goes on two lines, so it stays inside its own hex. */}
              <text x={c.x.toFixed(1)} y={(c.y + nameBaseline(id)).toFixed(1)} className="cmp-map-name">
                {nameLines(id).length > 1
                  ? nameLines(id).map((word, i) => (
                      <tspan key={word} x={c.x.toFixed(1)} dy={i === 0 ? 0 : 11}>
                        {word}
                      </tspan>
                    ))
                  : nameLines(id)[0]}
              </text>
            </g>
          )
        })}
        {chapters.map((chapter, i) => {
          const p = pins[i]!
          const done = completed.includes(chapter.id)
          const state = done ? 'done' : i === here ? 'current' : 'ahead'
          return (
            <g
              key={chapter.id}
              className={`cmp-pin cmp-pin-${state}${picked === chapter.id ? ' is-picked' : ''}`}
              data-chapter={chapter.id}
              transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`}
              onClick={() => (onPick ? onPick(chapter) : onStart(chapter))}
              aria-hidden="true"
            >
              {/* Plan item 386: a 44 px+ hit target round the stop on a phone (the disc draws about 24 px). */}
              <circle r={hitR} className="cmp-pin-hit" />
              {picked === chapter.id && <circle r={15.5} className="cmp-pin-ring" />}
              {state === 'current' && <circle r={15} className="cmp-pin-pulse" />}
              <circle r={11} className="cmp-pin-disc" />
              <text y={4} className="cmp-pin-n">
                {i + 1}
              </text>
            </g>
          )
        })}
        {/* Positioned by CSS transform (custom properties, set without a style attribute) so a walk between
            pins can transition. */}
        <g
          className="cmp-map-cath"
          data-at={herChapter.id}
          ref={(el) => {
            // Plan item 49: her box comes from the map layout, whose unit test keeps it clear of every name.
            const box = cathBox(herPin)
            el?.style.setProperty('--cx', `${box.x0.toFixed(1)}px`)
            el?.style.setProperty('--cy', `${box.y0.toFixed(1)}px`)
          }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: cath }}
        />
      </svg>
      {host && <div className="cmp-map-host">{host}</div>}
      {celebrate && (phase === 'walk' || phase === 'done') && !allDone && (
        <figcaption className="cmp-map-next" role="status">
          <span className="cmp-map-next-kicker">Next stop</span> Chapter {here + 1}: {herChapter.title}
        </figcaption>
      )}
    </figure>
  )
}

// The title's Campaign key carries the map's progress (plan item 35): Marrow's seven regions in little,
// freed ones green. Text for screen readers says the same.
export function MarrowBadge({ completed }: { completed: readonly string[] }) {
  const free = liberatedRegions(completed)
  const r = 5.2
  const w = r * Math.sqrt(3)
  return (
    <span className="marrow-badge" data-free={free.size}>
      <svg viewBox="-17 -15 34 30" aria-hidden="true">
        {(Object.keys(MAP_AXIAL) as RegionId[]).map((id) => {
          const [q, rr] = MAP_AXIAL[id]!
          return (
            <polygon
              key={id}
              points={hexPoints(r * 0.92)}
              transform={`translate(${(w * (q + rr / 2)).toFixed(1)} ${(1.5 * r * rr).toFixed(1)})`}
              className={free.has(id) ? 'marrow-badge-hex is-free' : 'marrow-badge-hex'}
            />
          )
        })}
      </svg>
      <span className="sr-only">{`, ${free.size} of 7 regions liberated`}</span>
    </span>
  )
}
