import { useMemo } from 'react'
import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import { CHAPTER_HOMES, MAP_AXIAL, currentChapterIndex, liberatedRegions } from '../content/campaignMap'
import type { RegionId } from '../engine/types'
import { cathSvg } from '../../shared/cath/cath'

// Plan item 35: the Republic of Marrow, drawn in code, as the campaign's map. Regions held by Hollowell
// are orange; a won chapter frees its home regions (green, with bunting). Each chapter is a numbered pin
// on a dotted lane, and Cath stands at the one that's next. The chapter cards below stay the accessible
// way in (each is a real button); the pins are a pointer shortcut to the same thing.
//
// Test hooks: each region is `[data-region]` with `data-liberated="true"` once freed; Cath is
// `.cmp-map-cath` with `data-at` naming the chapter she stands at.

const R = 52
const W = R * Math.sqrt(3)

function centre(id: RegionId): { x: number; y: number } {
  const [q, r] = MAP_AXIAL[id]!
  return { x: W * (q + r / 2), y: 1.5 * R * r }
}

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

function pinOf(chapter: Chapter): { x: number; y: number } {
  const home = CHAPTER_HOMES[chapter.id]?.[0] ?? chapter.activeRegions[0]!
  const c = centre(home)
  return { x: c.x, y: c.y + R * 0.42 }
}

// A swag of pennants across a freed hex's upper edge.
function Bunting() {
  const flags = 5
  const span = W * 0.56
  const x0 = -span / 2
  const top = -R * 0.72
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

export default function CampaignMap({ chapters, completed, onStart }: { chapters: Chapter[]; completed: string[]; onStart(chapter: Chapter): void }) {
  const free = liberatedRegions(completed)
  const here = currentChapterIndex(
    chapters.map((c) => c.id),
    completed,
  )
  const allDone = chapters.every((c) => completed.includes(c.id))
  const herChapter = chapters[here]!
  const herPin = pinOf(herChapter)
  const nextHomes = new Set(allDone ? [] : (CHAPTER_HOMES[herChapter.id] ?? []))
  const cath = useMemo(
    () => cathSvg({ framing: 'half', pose: allDone ? 'cheer' : 'wave', expression: allDone ? 'delighted' : 'smirk', width: 34, height: 51, animate: true }),
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
    <figure className="cmp-map" data-free={freedCount}>
      <svg className="cmp-map-svg" viewBox="-160 -150 320 296" role="img" aria-label={label}>
        <path className="cmp-map-land" d="M-150 -40 Q-160 -130 -60 -140 Q40 -152 120 -118 Q160 -60 150 30 Q158 120 70 140 Q-30 152 -110 128 Q-162 80 -150 -40 Z" />
        {(Object.keys(MAP_AXIAL) as RegionId[]).map((id) => {
          const c = centre(id)
          const isFree = free.has(id)
          const cls = `cmp-map-hex cmp-map-${REGIONS[id].type} ${isFree ? 'is-free' : 'is-held'}${nextHomes.has(id) ? ' is-next' : ''}`
          return (
            <g key={id} data-region={id} data-liberated={isFree ? 'true' : 'false'} className={cls} transform={`translate(${c.x.toFixed(1)} ${c.y.toFixed(1)})`}>
              <polygon points={hexPoints(R * 0.96)} className="cmp-map-ground" />
              <polygon points={hexPoints(R * 0.96)} className="cmp-map-tint" />
              {isFree && <Bunting />}
              <text y={-R * 0.26} className="cmp-map-name">
                {REGIONS[id].name}
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
        <g
          className="cmp-map-cath"
          data-at={herChapter.id}
          transform={`translate(${(herPin.x + 12).toFixed(1)} ${(herPin.y - 41).toFixed(1)})`}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: cath }}
        />
      </svg>
    </figure>
  )
}
