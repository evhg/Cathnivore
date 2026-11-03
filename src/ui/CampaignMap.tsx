import { useEffect, useMemo, useState } from 'react'
import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import { CHAPTER_HOMES, MAP_AXIAL, currentChapterIndex, liberatedRegions } from '../content/campaignMap'
import { BUNTING, CATH_SIZE, LANDMARKS, cathBox, MAP_FACE_R, MAP_R, type LandmarkKind, landmarkAt, nameBaseline, nameLines, pinCentre, postAt, regionCentre, riverPath } from '../content/campaignMapLayout'
import { BOARD_FACE_R, GroundArt } from './Map'
import type { RegionId } from '../engine/types'
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

// Plan item 49: each region's landmark, drawn in a 24-unit box round its centre in the board's ink style.
const INK = { stroke: 'var(--ink)', strokeWidth: 1.1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
function Landmark({ kind }: { kind: LandmarkKind }) {
  switch (kind) {
    case 'cross':
      return (
        <g {...INK}>
          <path d="M-10 11 H10 V7 H-10 Z M-7 7 V3 H7 V7" fill="var(--region-capital)" />
          <path d="M-1.6 3 V-9 H1.6 V3 Z" fill="var(--paper)" />
          <path d="M-5 -6 H5" strokeWidth={2.2} stroke="var(--soil)" />
          <circle cx={0} cy={-11} r={1.8} fill="var(--wheat)" />
        </g>
      )
    case 'mill':
      return (
        <g {...INK}>
          <path d="M-11 10 V-2 L-4 -8 L3 -2 V10 Z" fill="var(--paper)" />
          <path d="M-4 -8 L3 -2 H-11 Z" fill="var(--clay)" />
          <rect x={-7} y={2} width={4} height={8} fill="var(--soil)" />
          <circle cx={6} cy={4} r={6.5} fill="var(--region-crop)" />
          <path d="M6 -2.5 V10.5 M-0.5 4 H12.5 M1.4 -0.6 L10.6 8.6 M10.6 -0.6 L1.4 8.6" strokeWidth={0.9} />
        </g>
      )
    case 'docks':
      return (
        <g {...INK}>
          <path d="M-12 1 H6 V4 H-12 Z" fill="var(--soil)" />
          <path d="M-9 4 V10 M-3 4 V10 M3 4 V10" />
          <path d="M-12 10 Q-6 8 0 10 T12 10" fill="none" stroke="var(--sea)" />
          <path d="M2 -1 H12 L9.5 -5 H4.5 Z" fill="var(--clay)" />
          <path d="M7 -5 V-12 L11 -6 Z" fill="var(--paper)" />
        </g>
      )
    case 'lighthouse':
      return (
        <g {...INK}>
          <path d="M-12 11 Q-4 6 4 9 T12 11 Z" fill="var(--soil)" opacity={0.5} />
          <path d="M-4 9 L-2.6 -6 H2.6 L4 9 Z" fill="var(--paper)" />
          <path d="M-3.6 3 H3.6 M-3 -2 H3" stroke="var(--clay)" strokeWidth={2} />
          <rect x={-3} y={-10} width={6} height={4} fill="var(--wheat)" />
          <path d="M-4 -10 L0 -13 L4 -10 Z" fill="var(--clay)" />
        </g>
      )
    case 'oak':
      return (
        <g {...INK}>
          <path d="M-2 11 L-1.5 1 L1.5 1 L2 11 Z" fill="var(--soil)" />
          <path d="M-10 2 Q-13 -5 -7 -8 Q-6 -13 0 -12 Q6 -13 7 -8 Q13 -5 10 2 Q6 6 0 3 Q-6 6 -10 2 Z" fill="var(--pasture)" />
          <path d="M-12 11 H12" />
        </g>
      )
    case 'barn':
      return (
        <g {...INK}>
          <path d="M-11 10 V-1 L-6 -8 H6 L11 -1 V10 Z" fill="var(--clay)" />
          <path d="M-4 10 V2 H4 V10 M-4 2 L4 10 M4 2 L-4 10" fill="var(--paper)" strokeWidth={0.9} />
          <path d="M-12 -1 L-6 -9 H6 L12 -1" fill="none" stroke="var(--soil)" strokeWidth={1.6} />
        </g>
      )
    case 'fold':
      return (
        <g {...INK}>
          <path d="M-12 10 Q-12 -2 0 -3 Q12 -2 12 10" fill="none" stroke="var(--soil)" strokeWidth={2.4} strokeDasharray="3 1.4" />
          {[[-5, 4], [4, 6], [0, -0]].map(([x, y]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
              <ellipse rx={4.2} ry={3} fill="var(--paper)" />
              <circle cx={4} cy={-1.4} r={1.6} fill="var(--ink)" stroke="none" />
            </g>
          ))}
        </g>
      )
  }
}

// Hollowell's sign post: an orange board on a stake, nailed into each region they still hold.
function Post() {
  return (
    <g className="cmp-post" aria-hidden="true">
      <path d="M0 2 V-12" stroke="var(--soil)" strokeWidth={1.6} strokeLinecap="round" />
      <path d="M-6 -15 H6 V-8 H-6 Z" className="cmp-post-board" />
      <path d="M-3.5 -11.5 H3.5" stroke="var(--paper-on-fixed-fill)" strokeWidth={1.2} strokeLinecap="round" />
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

// The chapter-complete moment (plan item 35), in phases: 'before' (the chapter's regions still held, Cath
// at its pin), 'flood' (they turn green and the bunting drops), 'walk' (Cath walks to the next pin and
// the next chapter's caption slides in), then 'done'. Reduced motion fades between the same states.
type Phase = 'before' | 'flood' | 'walk' | 'done'
const PHASE_MS: Record<Exclude<Phase, 'done'>, number> = { before: 450, flood: 1300, walk: 1400 }

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
}: {
  chapters: Chapter[]
  completed: string[]
  onStart(chapter: Chapter): void
  celebrate?: string
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
  const cath = useMemo(
    () => cathSvg({ framing: 'half', pose: allDone ? 'cheer' : 'wave', expression: allDone ? 'delighted' : 'smirk', width: CATH_SIZE.w, height: CATH_SIZE.h, animate: true }),
    [allDone],
  )
  const pins = chapters.map(pinOf)
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
  const freedCount = free.size
  const label = allDone
    ? 'Map of Marrow: every region liberated.'
    : `Map of Marrow: ${freedCount} of 7 regions liberated. Next: chapter ${here + 1}, ${herChapter.title}.`

  return (
    <figure className="cmp-map" data-free={freedCount} data-phase={phase}>
      <svg className="cmp-map-svg" viewBox="-160 -150 320 296" role="img" aria-label={label}>
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
          return (
            <g key={id} data-region={id} data-liberated={isFree ? 'true' : 'false'} className={cls} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
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
        {regionIds.map((id) => {
          const c = centre(id)
          const isFree = free.has(id)
          const lm = landmarkAt(id)
          const post = postAt(id)
          const showPost = !isFree && id !== herHome
          return (
            <g key={id} className={`cmp-map-dress ${isFree ? 'is-free' : 'is-held'}${flooding.has(id) ? ' is-flooding' : ''}`} aria-hidden="true">
              <g transform={`translate(${lm.x.toFixed(1)} ${lm.y.toFixed(1)})`} className="cmp-landmark" data-landmark={LANDMARKS[id]!.kind}>
                <Landmark kind={LANDMARKS[id]!.kind} />
              </g>
              {showPost && (
                <g transform={`translate(${post.x.toFixed(1)} ${post.y.toFixed(1)})`}>
                  <Post />
                </g>
              )}
              {isFree && (
                <g transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
                  <Bunting />
                </g>
              )}
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
        <path d={lane} className="cmp-map-lane" />
        {chapters.map((chapter, i) => {
          const p = pins[i]!
          const done = completed.includes(chapter.id)
          const state = done ? 'done' : i === here ? 'current' : 'ahead'
          return (
            <g key={chapter.id} className={`cmp-pin cmp-pin-${state}`} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`} onClick={() => onStart(chapter)} aria-hidden="true">
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
