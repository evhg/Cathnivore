import { useMedia } from './useMedia'
import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import type { RegionId } from '../engine/types'
import Portrait from './portraits/Portrait'
import CathArt from './CathArt'
import { ProduceCrates } from './TableProps'
import CampaignMap from './CampaignMap'
import { CHAPTER_HOMES, CHAPTER_SEALS, MAP_AXIAL, hasHardSeal, liberatedRegions } from '../content/campaignMap'
import { LANDMARKS } from '../content/campaignMapLayout'
import { Landmark } from './Landmark'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import type { CathPoseId } from '../../shared/cath/cath'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEPART_MS, DEPART_STILL_MS, departFrame, departureOn } from './departure'
import { playCues } from '../platform/sound'
import { campaignLine } from '../content/campaignLines'

// SPEC 10.1 campaign screen, drawn as a journey across Marrow (ROADMAP 9): each chapter is a stop on a
// path, with a mini map of the regions it plays on and the producers who play it. Locked chapters stay
// clickable (SPEC 8.1: "Progress is never locked"); the lock is only a hint.
//
// Test hooks: each chapter is a button whose accessible name starts with the chapter title and includes
// "(completed)" or "(locked)" (e2e/chapter-resume.spec.ts and others rely on this).

const R = 10
const W = R * Math.sqrt(3)
const AXIAL: Partial<Record<RegionId, [number, number]>> = {
  highmoor: [0, -1],
  saltmarsh: [1, -1],
  brindleHills: [-1, 0],
  kingsmarket: [0, 0],
  rivermead: [1, 0],
  oakvale: [-1, 1],
  shingleBay: [0, 1],
}

function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`
  }).join(' ')
}

function MiniMap({ chapter }: { chapter: Chapter }) {
  const active = new Set(chapter.activeRegions)
  return (
    <svg className="cmp-minimap" viewBox="-30 -28 60 56" aria-hidden="true">
      {(Object.keys(AXIAL) as RegionId[]).map((id) => {
        const [q, r] = AXIAL[id]!
        const x = W * (q + r / 2)
        const y = 1.5 * R * r
        const on = active.has(id)
        return (
          <polygon
            key={id}
            points={hexPoints(R * 0.94)}
            transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
            className={on ? `cmp-hex cmp-${REGIONS[id].type}` : 'cmp-hex cmp-off'}
          />
        )
      })}
    </svg>
  )
}

// Plan item 35: three wax seals per chapter (the win, the win on Hard, a chapter feat), pressed when
// earned and blind-embossed when not. Inside the card's button, so they're text for screen readers.
function WaxSeals({ chapter, earned }: { chapter: Chapter; earned: string[] }) {
  const defs = CHAPTER_SEALS[chapter.id]
  if (!defs) return null
  const rows: Array<{ id: string; label: string; glyph: string }> = [
    { id: 'win', label: 'Won', glyph: 'M-4 0.5 L-1 3.5 L4.5 -3' },
    { id: 'hard', label: defs.hard.label, glyph: hasHardSeal(chapter.id) ? 'M-4 3 L-4 -1 L-1.5 1 L0 -4 L1.5 1 L4 -1 L4 3 Z' : 'M-1 -4.5 L3 -4.5 L0.5 -0.5 L3.5 -0.5 L-2 4.5 L-0.5 0.8 L-3.5 0.8 Z' },
    { id: 'feat', label: defs.feat.label, glyph: 'M0 -4.5 L1.3 -1.4 L4.5 -1.4 L1.9 0.6 L2.9 4 L0 2 L-2.9 4 L-1.9 0.6 L-4.5 -1.4 L-1.3 -1.4 Z' },
  ]
  return (
    <span className="cmp-seals">
      {rows.map((r) => {
        const on = earned.includes(r.id)
        return (
          <span key={r.id} className={on ? 'cmp-seal is-earned' : 'cmp-seal'} data-seal={r.id} data-earned={on ? 'true' : 'false'} title={r.label}>
            <svg viewBox="-10 -10 20 20" aria-hidden="true">
              <path className="cmp-seal-wax" d="M0 -9 C3 -9.5 4.5 -7 6.6 -6.2 C9 -5 8.6 -2 9.2 0 C9.6 2.5 7.4 4 6.4 6.3 C5 8.6 2.4 8.8 0 9.2 C-2.6 9.6 -4.6 7.6 -6.4 6.4 C-8.6 5 -8.8 2.4 -9.2 0 C-9.4 -2.6 -7.8 -4.4 -6.3 -6.4 C-4.8 -8.4 -2.4 -8.6 0 -9 Z" />
              <circle r={6} className="cmp-seal-ring" />
              <path d={r.glyph} className="cmp-seal-glyph" />
            </svg>
            <span className="sr-only">{`${r.label}: ${on ? 'earned' : 'not yet'}. `}</span>
          </span>
        )
      })}
    </span>
  )
}

function Medallion({ n, state }: { n: number; state: 'done' | 'current' | 'locked' }) {
  return (
    <span className={`cmp-medallion cmp-${state}`} aria-hidden="true">
      {state === 'done' ? (
        <svg viewBox="-20 -20 40 40">
          {Array.from({ length: 6 }, (_, k) => {
            const a = (k * 60 * Math.PI) / 180
            return <circle key={k} cx={Math.cos(a) * 9} cy={Math.sin(a) * 9} r={7} className="cmp-petal" />
          })}
          <circle r={9} className="cmp-petal" />
          <path d="M-5 0.5 L-1.5 4 L5.5 -3.5" className="cmp-tick" />
        </svg>
      ) : state === 'locked' ? (
        <svg viewBox="-20 -20 40 40">
          <circle r={16} className="cmp-disc" />
          <rect x={-6} y={-2} width={12} height={9} rx={2} className="cmp-lock" />
          <path d="M-3.5 -2 V-5 a3.5 3.5 0 0 1 7 0 V-2" className="cmp-lock-loop" />
        </svg>
      ) : (
        <span className="cmp-number">{n}</span>
      )}
    </span>
  )
}

// Plan item 113: each chapter card's vignette, a drawn postcard of its regions' landmarks (the map's own
// landmark art, `Landmark.tsx`) on hills in their region colours, at full ink; a locked chapter's is in pencil.
// The regions winning it frees come first and stand largest.
const VIG_W = 132
/** Plan item 325: Cath's pose as she presents each chapter (with campaignLines' expressions, no two chapters alike). */
const CHAPTER_POSE: Record<string, CathPoseId> = {
  'fresh-meat': 'point',
  'word-of-mouth': 'wave',
  'growing-season': 'can',
  'the-plan': 'thinking',
  'friends-in-low-places': 'crossed',
  kingsmarket: 'flag',
}
const VIG_H = 88
function vignetteRegions(chapter: Chapter): RegionId[] {
  const homes = CHAPTER_HOMES[chapter.id] ?? []
  const out: RegionId[] = [...homes]
  for (const r of chapter.activeRegions) if (!out.includes(r) && LANDMARKS[r]) out.push(r)
  return out.slice(0, 3)
}
// Plan item 150: the chapter's producer keeps a stall in its scene, and a won chapter's scene is coloured in
// with the co-op's bunting across it and the sun out. `data-chapter-art` names the state: locked (pencil),
// current, or done.
const BUNTING_FLAGS = 7

/** Item 309: a small scene per chapter, in the vignette's front left (vignette units, 132 x 88). */
function ChapterMotif({ id, at = 'translate(5 68)' }: { id: string; at?: string }) {
  const ink = { stroke: 'var(--ink)', strokeWidth: 0.7, strokeLinejoin: 'round' as const }
  let art: React.ReactNode = null
  if (id === 'word-of-mouth') {
    // A queue chatting at the stall: three heads and shoulders, a speech bubble over them.
    art = (
      <>
        {[0, 9, 18].map((x, k) => (
          <g key={x} transform={`translate(${x} ${k === 1 ? -1 : 0})`}>
            <path d="M0 14 Q0 7 4 7 Q8 7 8 14 Z" fill={k === 1 ? 'var(--clay)' : k === 2 ? 'var(--pasture-deep)' : 'var(--sea)'} {...ink} />
            <circle cx={4} cy={4.5} r={2.6} fill="var(--paper-hi)" {...ink} />
          </g>
        ))}
        <path d="M14 -6 h10 a2.5 2.5 0 0 1 2.5 2.5 v3 a2.5 2.5 0 0 1 -2.5 2.5 h-6 l-3 3 v-3 h-1 a2.5 2.5 0 0 1 -2.5 -2.5 v-3 a2.5 2.5 0 0 1 2.5 -2.5 z" fill="var(--paper-hi)" {...ink} />
        <path d="M16.5 -3 h6 M16.5 -1 h4" stroke="var(--ink)" strokeWidth={0.6} />
      </>
    )
  } else if (id === 'growing-season') {
    // Rows of seedlings on dark tilled earth.
    art = (
      <>
        <path d="M0 14 L30 14 L26 6 L4 6 Z" fill="var(--soil)" {...ink} />
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2, 3].map((c) => {
            const x = 6 + c * 6 + r * 0.6
            const y = 8 + r * 2.6
            return <path key={`${r}-${c}`} d={`M${x} ${y} v-2.2 M${x} ${y - 1.4} q-1.6 -1.4 -2.2 -0.4 M${x} ${y - 1.8} q1.6 -1.6 2.2 -0.4`} stroke="var(--pasture-deep)" strokeWidth={0.8} fill="none" strokeLinecap="round" />
          }),
        )}
      </>
    )
  } else if (id === 'the-plan') {
    // The plan pinned to an easel: a sheet with a route drawn on it.
    art = (
      <>
        <path d="M6 16 L11 -2 M20 16 L15 -2 M13 -2 V16" fill="none" {...ink} />
        <rect x={4} y={-6} width={18} height={13} rx={0.8} fill="var(--paper-hi)" {...ink} />
        <path d="M7 3 Q10 -3 13 1 T19 -3" fill="none" stroke="var(--clay)" strokeWidth={0.9} strokeDasharray="1.4 1" />
        <circle cx={19} cy={-3} r={1.2} fill="var(--clay)" stroke="none" />
      </>
    )
  } else if (id === 'friends-in-low-places') {
    // A cellar door down a few steps, a lamp lit over it.
    art = (
      <>
        <path d="M2 14 H28 V4 H2 Z" fill="var(--wood)" {...ink} />
        <path d="M10 14 V7 Q15 3 20 7 V14 Z" fill="var(--soil)" {...ink} />
        <circle cx={18} cy={11} r={0.7} fill="var(--wheat)" stroke="none" />
        <path d="M24 4 V0 M22.5 0 h3 l-0.6 3 h-1.8 Z" fill="var(--wheat)" {...ink} />
      </>
    )
  } else if (id === 'kingsmarket') {
    // The market's crown on a hanging banner.
    art = (
      <>
        <path d="M6 -4 H24 M8 -4 V14 L15 10 L22 14 V-4" fill="var(--clay)" {...ink} />
        <path d="M10 6 L10 0 L12.5 3 L15 -1 L17.5 3 L20 0 L20 6 Z" fill="var(--wheat)" {...ink} />
      </>
    )
  }
  if (!art) return null
  return (
    <g className="cmp-vig-mark cmp-vig-motif" data-motif={id} transform={at}>
      {art}
    </g>
  )
}
/**
 * Plan item 435: each chapter's print is its own composition, not one row of landmarks with the sky recoloured:
 * where the horizon sits, what stands largest and where the stall is all change per chapter, so the six read apart in
 * greyscale at thumbnail size (e2e/campaign-prints.spec.ts measures it). `ground` draws the land (region-coloured,
 * dimmed at dusk like the hills), `marks` the chapter's landmarks large, `stall` places the producer's stall.
 */
interface ChapterScene {
  far: string
  ground: React.ReactNode
  marks: { region: RegionId; x: number; y: number; s: number }[]
  motif: string
  stall: { x: number; y: number; s: number }
  sun?: [number, number]
  front?: React.ReactNode
  /** The phone tab's crop: which side of the scene its subject stands on. */
  crop?: 'xMinYMax' | 'xMidYMax' | 'xMaxYMax'
}
const LINE = { stroke: 'var(--ink)', strokeWidth: 0.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const CHAPTER_SCENES: Record<string, ChapterScene> = {
  // The coast: a low horizon over open sea, the lighthouse tall on its spit at the right, the queue at the stall on
  // the beach at the left with the talk going round.
  'word-of-mouth': {
    crop: 'xMaxYMax',
    far: 'M0 50 Q30 44 62 49 T132 46 V88 H0 Z',
    ground: (
      <>
        <path className="cmp-vig-hill cmp-vig-coast" d="M-2 89 V55 Q34 52 66 55 T134 54 V89 Z" />
        <path className="cmp-vig-hill cmp-vig-pasture" d="M86 89 V66 Q98 56 134 58 V89 Z" />
        <path className="cmp-vig-hill cmp-vig-crop" d="M-2 89 V74 Q30 68 70 76 L74 89 Z" />
      </>
    ),
    marks: [{ region: 'saltmarsh', x: 108, y: 38, s: 2.05 }],
    motif: 'translate(38 52) scale(1.45)',
    stall: { x: 4, y: 46, s: 1.05 },
    sun: [70, 18],
    front: (
      <g className="cmp-vig-mark">
        <path d="M74 62 q4 -2 8 0 M58 60 q4 -2 8 0 M80 70 q3 -1.6 6 0" fill="none" {...LINE} stroke="var(--paper-hi)" />
      </g>
    ),
  },
  // The orchard valley: ploughed rows running away to the horizon fill the foreground, the old oak huge at the
  // right, the stall at the head of the rows.
  'growing-season': {
    crop: 'xMaxYMax',
    far: 'M0 44 Q40 34 80 42 T132 40 V88 H0 Z',
    ground: (
      <>
        <path className="cmp-vig-hill cmp-vig-crop" d="M-2 89 V48 Q66 44 134 48 V89 Z" />
        {Array.from({ length: 6 }, (_, k) => {
          const x0 = -30 + k * 36
          return <path key={k} className="cmp-vig-furrow" d={`M${60 + k * 2.6} 48 L${63 + k * 2.6} 48 L${x0 + 20} 89 L${x0} 89 Z`} />
        })}
      </>
    ),
    marks: [
      { region: 'oakvale', x: 104, y: 35, s: 2.05 },
      { region: 'rivermead', x: 44, y: 38, s: 0.75 },
    ],
    motif: 'translate(70 70) scale(0.9)',
    stall: { x: 4, y: 48, s: 1.1 },
    sun: [76, 14],
  },
  // The plan: the river winds down from the mill at the top left, and the plan itself, pinned to its easel, stands
  // large in the foreground at the right.
  'the-plan': {
    far: 'M0 30 Q30 22 64 28 T132 24 V88 H0 Z',
    ground: (
      <>
        <path className="cmp-vig-hill cmp-vig-pasture" d="M-2 89 V34 Q60 28 134 34 V89 Z" />
        <path className="cmp-vig-hill cmp-vig-coast" d="M40 34 Q30 48 52 56 T44 89 H66 Q80 64 60 54 T52 34 Z" />
      </>
    ),
    marks: [
      { region: 'rivermead', x: 22, y: 30, s: 1.7 },
      { region: 'brindleHills', x: 100, y: 26, s: 0.75 },
    ],
    motif: 'translate(70 38) scale(2.3)',
    stall: { x: 2, y: 54, s: 1.05 },
    sun: [114, 12],
  },
  // A cellar lane by the harbour: a tall stone wall fills the left with its door lit, the docks and a boat on the
  // water at the right.
  'friends-in-low-places': {
    crop: 'xMinYMax',
    far: 'M0 52 Q50 46 132 50 V88 H0 Z',
    ground: (
      <>
        <path className="cmp-vig-hill cmp-vig-coast" d="M-2 89 V58 Q66 54 134 58 V89 Z" />
        <path className="cmp-vig-hill cmp-vig-capital" d="M-2 89 V16 H18 V10 H34 V18 H52 V12 H70 V89 Z" />
        {[24, 34, 44, 54, 64, 74].map((y) => (
          <path key={y} className="cmp-vig-course" d={`M0 ${y} H70`} />
        ))}
      </>
    ),
    marks: [{ region: 'shingleBay', x: 108, y: 56, s: 1.8 }],
    motif: 'translate(6 50) scale(1.8)',
    stall: { x: 58, y: 56, s: 0.95 },
    sun: [100, 14],
  },
  // Market day in the capital: the cross huge in the square, a row of market awnings across the foreground, the
  // town's roofs behind.
  kingsmarket: {
    far: 'M0 40 H10 L16 32 L22 40 H40 V30 H50 V40 H82 L90 30 L98 40 H112 V32 H122 V40 H132 V88 H0 Z',
    ground: <path className="cmp-vig-hill cmp-vig-capital" d="M-2 89 V50 Q66 46 134 50 V89 Z" />,
    marks: [{ region: 'kingsmarket', x: 62, y: 44, s: 2.1 }],
    motif: 'translate(100 14) scale(0.9)',
    stall: { x: 2, y: 58, s: 1 },
    sun: [116, 50],
    front: (
      <g className="cmp-vig-mark">
        {[0, 1].map((t) => (
          <g key={t} transform={`translate(${91 + t * 21} 60)`}>
            <path d="M1 6 V22 M19 6 V22" fill="none" {...LINE} />
            <rect x={0} y={16} width={20} height={9} rx={1} fill="var(--wood)" {...LINE} />
            <path d="M-2 6 H22 L19 0 H1 Z" fill={t ? 'var(--pasture)' : 'var(--sea)'} {...LINE} />
            <path d="M4 0 H8 L9 6 H5 Z M12 0 H16 L17 6 H13 Z" fill="var(--paper-hi)" stroke="none" />
          </g>
        ))}
      </g>
    ),
  },
}

// Plan item 444: on a desktop the campaign's progress is a string of six pennants hung across the top band from the
// signboard, one per chapter: a won chapter's flag is dyed and lifted, an unwon one is plain calico.
const PENNANT_DYES = ['clay', 'wheat', 'pasture', 'sea', 'clay', 'wheat'] as const
function ProgressBunting({ chapters, completed }: { chapters: Chapter[]; completed: string[] }) {
  const n = chapters.length
  const W = 600
  const won = chapters.filter((c) => completed.includes(c.id)).length
  const sag = (t: number) => 10 + 34 * 4 * t * (1 - t)
  return (
    <svg className="cmp-pennants" viewBox={`0 0 ${W} 96`} role="img" aria-label={`${won} of ${n} chapters won`} data-won={won}>
      <path className="cmp-pennants-line" d={`M0 10 Q${W / 2} 78 ${W} 10`} />
      {chapters.map((c, i) => {
        const t = (i + 0.5) / n
        const x = t * W
        const y = sag(t)
        const isWon = completed.includes(c.id)
        return (
          <g key={c.id} className={isWon ? `cmp-pennant is-won is-${PENNANT_DYES[i % PENNANT_DYES.length]}` : 'cmp-pennant'} transform={`translate(${x} ${y})`} data-chapter={c.id}>
            <path className="cmp-pennant-cloth" d="M-22 0 L22 0 L0 50 Z" />
            <text className="cmp-pennant-num" x={0} y={20}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

function ChapterVignette({ chapter, state, mini = false }: { chapter: Chapter; state: 'locked' | 'current' | 'done'; mini?: boolean }) {
  const locked = state === 'locked'
  const producer = chapter.producers[0]
  const regions = vignetteRegions(chapter)
  const homes = new Set(CHAPTER_HOMES[chapter.id] ?? [])
  const n = regions.length
  const slot = VIG_W / n
  const scene = CHAPTER_SCENES[chapter.id]
  const sun = scene?.sun ?? [18, 15]
  const stallAt = scene ? `translate(${scene.stall.x} ${scene.stall.y}) scale(${scene.stall.s})` : `translate(${VIG_W - 34} ${VIG_H - 33})`
  return (
    <svg
      className={(locked ? 'cmp-vignette is-sealed' : state === 'done' ? 'cmp-vignette is-won' : 'cmp-vignette') + (mini ? ' is-mini' : '')}
      viewBox={`0 0 ${VIG_W} ${VIG_H}`}
      preserveAspectRatio={mini ? `${scene?.crop ?? 'xMidYMax'} slice` : undefined}
      data-regions={regions.join(' ')}
      data-chapter-art={mini ? undefined : state}
      data-chapter={chapter.id}
      aria-hidden="true"
    >
      <rect className="cmp-vig-sky" x={0} y={0} width={VIG_W} height={VIG_H} />
      {/* Plan item 279: each locked chapter waits at its own hour of the evening (campaign.css), the later ones
          under stars. */}
      {locked && (
        <g className="cmp-vig-stars">
          {[[40, 9], [58, 20], [74, 7], [96, 16], [112, 30], [30, 30], [86, 31]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={0.9} />
          ))}
        </g>
      )}
      <circle className="cmp-vig-sun" cx={sun[0]} cy={sun[1]} r={7} />
      {scene ? (
        <>
          <path className="cmp-vig-far" d={scene.far} />
          {scene.ground}
          {scene.marks.map((m) => (
            <g key={m.region} className="cmp-vig-mark" transform={`translate(${m.x} ${m.y}) scale(${m.s})`}>
              <Landmark kind={LANDMARKS[m.region]!.kind} />
            </g>
          ))}
          <ChapterMotif id={chapter.id} at={scene.motif} />
          {scene.front}
        </>
      ) : (
        <>
      <path className="cmp-vig-far" d={`M0 50 Q22 36 44 46 T88 42 T${VIG_W} 44 V${VIG_H} H0 Z`} />
      {regions.map((id, i) => {
        const x0 = i * slot
        const type = REGIONS[id].type
        const top = 54 + (i % 2) * 4
        return (
          <path
            key={`hill-${id}`}
            className={`cmp-vig-hill cmp-vig-${type}`}
            d={`M${x0 - 8} ${VIG_H} V${top + 8} Q${x0 + slot / 2} ${top - 10} ${x0 + slot + 8} ${top + 8} V${VIG_H} Z`}
          />
        )
      })}
      {regions.map((id, i) => {
        const s = homes.has(id) ? (n === 3 ? 1.5 : 1.8) : 1.25
        // The landmarks share the width left of the producer's stall (front right).
        const markSlot = (VIG_W - (producer ? 32 : 0)) / n
        const cx = i * markSlot + markSlot / 2
        const cy = 64 + (i % 2) * 4 - 11 * s
        return (
          <g key={id} className="cmp-vig-mark" transform={`translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${s})`}>
            <Landmark kind={LANDMARKS[id]!.kind} />
          </g>
        )
      })}
      {/* Item 309: each chapter's own motif in the front left, so no two plates read alike (drawn as a landmark, so a
          locked chapter shows it as line art too). */}
      <ChapterMotif id={chapter.id} />
        </>
      )}
      {/* The producer at their stall, front right: a striped awning over a counter, their bust behind it. */}
      {producer && (
        <g className="cmp-vig-stall" transform={stallAt}>
          <g transform="translate(5 -4)">
            <Portrait character={producer} size={20} />
          </g>
          <rect className="cmp-vig-counter" x={0} y={17} width={30} height={12} rx={1.5} />
          <path className="cmp-vig-awning" d="M-2 4 H32 L29 -2 H1 Z" />
          {[0, 1, 2, 3].map((k) => (
            <path key={k} className="cmp-vig-stripe" d={`M${2 + k * 8} -2 H${6 + k * 8} L${7 + k * 8} 4 H${2 + k * 8} Z`} />
          ))}
          <path className="cmp-vig-post" d="M1 4 V17 M29 4 V17" />
          <circle className="cmp-vig-produce" cx={8} cy={16} r={2.4} />
          <circle className="cmp-vig-produce is-b" cx={14} cy={16.3} r={2.2} />
          <circle className="cmp-vig-produce" cx={20} cy={16} r={2.4} />
        </g>
      )}
      {/* Won: the co-op's bunting strung across the scene, and the sun's rays. */}
      {state === 'done' && (
        <g className="cmp-vig-bunting">
          <path className="cmp-vig-string" d={`M4 10 Q${VIG_W / 2} 30 ${VIG_W - 4} 10`} />
          {Array.from({ length: BUNTING_FLAGS }, (_, k) => {
            const t = (k + 0.5) / BUNTING_FLAGS
            const x = 4 + t * (VIG_W - 8)
            const y = 10 + 4 * t * (1 - t) * 20 * 0.5
            return <path key={k} className={`cmp-vig-flag is-${k % 3}`} d={`M${(x - 4).toFixed(1)} ${y.toFixed(1)} H${(x + 4).toFixed(1)} L${x.toFixed(1)} ${(y + 8).toFixed(1)} Z`} />
          })}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => {
            const a = (k / 8) * Math.PI * 2
            return <path key={`ray-${k}`} className="cmp-vig-ray" d={`M${(sun[0] + Math.cos(a) * 9).toFixed(1)} ${(sun[1] + Math.sin(a) * 9).toFixed(1)} L${(sun[0] + Math.cos(a) * 12).toFixed(1)} ${(sun[1] + Math.sin(a) * 12).toFixed(1)}`} />
          })}
        </g>
      )}
      {/* Plan item 279: a locked chapter's scene waits at dusk under the co-op's wax seal: its land in colour, its
          landmarks and stall in silhouette, a seal pressed with a leaf at its heart. */}
      {/* Item 435: the locked chapter is a letter not yet opened: the envelope's flap folds down over the scene to the
          co-op's seal at its point. */}
      {locked && <path className="cmp-vig-flap" d={`M1 1 L${VIG_W / 2} 34 L${VIG_W - 1} 1 Z`} />}
      {locked && (
        <g className="cmp-vig-seal" transform={`translate(${VIG_W / 2} 32) scale(0.82)`}>
          <path
            className="cmp-vseal-wax"
            d={Array.from({ length: 12 }, (_, k) => {
              const a = (k / 12) * Math.PI * 2
              const r = k % 2 ? 12.5 : 14
              return `${k ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`
            }).join(' ') + ' Z'}
          />
          <circle className="cmp-vseal-rim" r={9.5} />
          <path className="cmp-vseal-leaf" d="M-5 4 C-5 -3 0 -7 6 -6 C6 0 2 5 -5 4 Z M-5 4 L3 -3" />
          <path className="cmp-vseal-shine" d="M-9 -6 A11 11 0 0 1 -3 -10.5" />
        </g>
      )}
      <rect className="cmp-vig-frame" x={0.75} y={0.75} width={VIG_W - 1.5} height={VIG_H - 1.5} rx={9} />
    </svg>
  )
}

export default function CampaignScreen({
  chapters,
  completed,
  tutorialDone = true,
  coachDone,
  seals,
  celebrate,
  onStartHard,
  onStart,
  onReplayTutorial,
  onBack,
}: {
  chapters: Chapter[]
  completed: string[]
  // The guided tutorial (chapter 1) is still ahead: its card says so, so a first-time player knows where to start.
  tutorialDone?: boolean
  // A later guided chapter's coach (chapter 2 on), by id: done once finished or skipped. Absent: all done.
  coachDone?: (chapterId: string) => boolean
  // Plan item 35: the wax seals a chapter has earned ('win', 'hard', 'feat'), and its Hard replay.
  seals?: (chapterId: string) => string[]
  // The chapter just won for the first time: the map plays its chapter-complete moment.
  celebrate?: string
  onStartHard?: (chapter: Chapter) => void
  onStart: (chapter: Chapter) => void
  onReplayTutorial?: (chapter: Chapter) => void
  onBack: () => void
}) {
  const done = chapters.filter((c) => completed.includes(c.id)).length
  let currentMarked = false
  // Plan item 113: Cath speaks about the chapter under the pointer or focus, else the next one to play.
  // Focus wins over hover: a focus scroll can slide another card under a resting pointer.
  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const pointed = focused ?? hovered
  const next = chapters.find((c, i) => !completed.includes(c.id) && (i === 0 || completed.includes(chapters[i - 1]!.id)))
  const wide = useMedia('(min-width: 1100px)')
  // Plan item 386: on a phone one chapter is open at a time, in a sheet under the map: a map stop or a tab opens it,
  // and the sheet is a carousel of the chapter cards (a swipe opens the next). It opens on the next chapter to play.
  const phone = useMedia('(max-width: 600px)')
  const [picked, setPicked] = useState<string | null>(null)
  const open = picked ?? next?.id ?? chapters[chapters.length - 1]!.id
  const listRef = useRef<HTMLOListElement>(null)
  const scrollTo = (id: string, smooth: boolean) => {
    const list = listRef.current
    const i = chapters.findIndex((c) => c.id === id)
    const li = list?.children[i] as HTMLElement | undefined
    if (!list || !li) return
    const left = list.scrollLeft + li.getBoundingClientRect().left - list.getBoundingClientRect().left
    list.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' })
  }
  const pick = (id: string) => {
    setPicked(id)
    scrollTo(id, !matchMedia('(prefers-reduced-motion: reduce)').matches)
  }
  useLayoutEffect(() => {
    if (phone) scrollTo(open, false)
    // Only when the layout changes to the phone's carousel: later picks scroll it themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])
  // Plan item 483: Start is a staged departure (departure.ts): the chapter's homes lift and glow at once, the atlas
  // zooms in on them, Cath steps toward them and the paper rustles; then the screen fades into the chapter. A tap
  // or a key skips it.
  const mainRef = useRef<HTMLElement>(null)
  const [departing, setDeparting] = useState<Chapter | null>(null)
  const leave = useRef<{ chapter: Chapter; timer: number } | null>(null)
  const finish = () => {
    const d = leave.current
    if (!d) return
    leave.current = null
    window.clearTimeout(d.timer)
    const root = document.documentElement
    root.dataset.arrived = ''
    window.setTimeout(() => delete root.dataset.arrived, 400)
    onStart(d.chapter)
  }
  useEffect(() => () => window.clearTimeout(leave.current?.timer), [])
  const start = (chapter: Chapter) => {
    if (leave.current) return
    if (!departureOn(location.search, navigator.webdriver)) return onStart(chapter)
    const main = mainRef.current
    const mapEl = main?.querySelector<HTMLElement>('.cmp-map-svg')
    if (main && mapEl) {
      const homes = (CHAPTER_HOMES[chapter.id] ?? chapter.activeRegions).flatMap((id) => {
        const el = mapEl.querySelector(`[data-region="${id}"]`)
        return el ? [el.getBoundingClientRect()] : []
      })
      const cath = main.querySelector('.cmp-host-stand')?.getBoundingClientRect()
      const f = departFrame(homes, mapEl.getBoundingClientRect(), cath)
      main.style.setProperty('--dep-x', `${f.x}px`)
      main.style.setProperty('--dep-y', `${f.y}px`)
      main.style.setProperty('--dep-s', String(f.scale))
      main.style.setProperty('--dep-step', `${f.step}px`)
    }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    leave.current = { chapter, timer: window.setTimeout(finish, still ? DEPART_STILL_MS : DEPART_MS) }
    setDeparting(chapter)
    if (!still) playCues(['paperSlide', 'paperFlip'])
  }
  const say = campaignLine(pointed ?? (phone ? open : next?.id), done === chapters.length)
  const stateOf = (i: number): 'done' | 'locked' | 'current' => {
    const c = chapters[i]!
    if (completed.includes(c.id)) return 'done'
    const previous = chapters[i - 1]
    return i > 0 && !!previous && !completed.includes(previous.id) ? 'locked' : 'current'
  }
  // Plan item 248: Cath hosts the map at full height, head to boots, with her line over her head. On a desktop she
  // narrates at half length in the map's sea beside the island (item 325); on a phone she stands beside her line in the header.
  // One copy in the DOM (mounted by viewport), so `.cmp-cath` and its line stay single for tests and screen readers.
  const host = (
    <figure className="cmp-cath" data-chapter={pointed ?? (phone ? open : next?.id) ?? 'done'} data-host={wide ? 'map' : 'header'} data-pose={CHAPTER_POSE[pointed ?? (phone ? open : next?.id) ?? ''] ?? SCREEN_POSE['cathnivore:campaign']} data-expression={say.expression}>
      <p className="cmp-cath-line" aria-live="polite">
        {say.line}
      </p>
      <span className="cmp-host-stand">
        {/* Plan item 325: she narrates the campaign at half length (her face the size of a narrator's), her pose
            per chapter; the full figure stays for Hedgerow's map and the site. */}
        <CathArt
          className="cmp-header-cath"
          framing="half"
          pose={CHAPTER_POSE[pointed ?? (phone ? open : next?.id) ?? ''] ?? SCREEN_POSE['cathnivore:campaign']}
          expression={say.expression}
          animate
          title="Cath"
        />
        {/* Plan item 444: at D she stands behind the stall's produce crates on the table's edge, so her half-length
            figure ends behind something drawn, not in mid-air; on a phone the crates stand on the board's lip */}
        {(wide || phone) && <ProduceCrates />}
      </span>
    </figure>
  )
  return (
    <main
      ref={mainRef}
      className="campaign campaign-screen"
      data-departing={departing?.id}
      onKeyDownCapture={
        departing
          ? (e) => {
              e.preventDefault()
              finish()
            }
          : undefined
      }
    >
      {/* Plan item 483: while the departure plays, a tap anywhere skips it */}
      {departing && <button type="button" className="cmp-depart-skip" aria-label={`Skip to ${departing.title}`} onClick={finish} />}
      <header className="cmp-header">
        <div className="cmp-header-text">
          <p className="cmp-kicker">The liberation of Marrow</p>
          <h1>Campaign</h1>
          {/* Plan item 398: at D the bar's words are hidden (the ledger says them), so the bar says them on hover. */}
          <p className="cmp-progress" title={`${done} of ${chapters.length} chapters won`}>
            {/* The map has seven regions and chapter 1 frees two, so the header counts both (critique 2026-11-03).
                Item 385: on a desktop the ledger under the map already says both, so the header keeps the bar alone. */}
            <span className={wide ? 'cmp-progress-text visually-hidden' : 'cmp-progress-text'}>
              {done} of {chapters.length} chapters
              <span className="cmp-progress-regions">
                {' · '}
                {liberatedRegions(completed).size} of {Object.keys(MAP_AXIAL).length} regions free
              </span>
            </span>
            {/* Plan item 415: at D the ledger under the map is the one progress mark (the bar said '0 of 6' twice). */}
            {!wide && (
              <span className="cmp-progress-bar" aria-hidden="true">
                <span className={`cmp-progress-fill cmp-fill-${done}`} />
              </span>
            )}
          </p>
        </div>
        {!wide && host}
        {wide && <ProgressBunting chapters={chapters} completed={completed} />}
        {/* Plan item 257: on a desktop the campaign's tally is chalked on a slate; plan item 444: it hangs in the top
            band beside the pennants (the chapters won), Back to Title a small tag on its frame, so the map takes the
            column's full height. */}
        {wide && (
          <div className="cmp-ledger" data-ledger>
            <dl className="cmp-ledger-cells">
              <div className="cmp-ledger-cell">
                <dt>Regions free</dt>
                <dd>
                  <b>{liberatedRegions(completed).size}</b> of {Object.keys(MAP_AXIAL).length}
                </dd>
              </div>
              <div className="cmp-ledger-cell">
                <dt>Seals pressed</dt>
                <dd>
                  <b>{chapters.reduce((n, c) => n + (seals?.(c.id) ?? (completed.includes(c.id) ? ['win'] : [])).length, 0)}</b> of {chapters.length * 3}
                </dd>
              </div>
            </dl>
            <button className="cmp-ledger-back cmp-back" onClick={onBack}>
              Back to Title
            </button>
          </div>
        )}
      </header>
      <CampaignMap
        chapters={chapters}
        completed={completed}
        onStart={start}
        celebrate={celebrate}
        departing={departing?.id}
        lit={pointed ?? (phone ? open : undefined)}
        host={wide ? host : undefined}
        onPick={phone ? (c) => pick(c.id) : undefined}
        picked={phone ? open : undefined}
        onPoint={phone ? undefined : setHovered}
      />
      {/* Plan item 386: on a phone a row of six chapter tabs opens each chapter in the sheet below. */}
      {phone && (
        <nav className="cmp-tabs" aria-label="Chapters">
          {chapters.map((c, i) => {
            const st = stateOf(i)
            return (
              <button
                key={c.id}
                type="button"
                className={`cmp-tab cmp-tab-${st}${open === c.id ? ' is-open' : ''}`}
                data-chapter={c.id}
                aria-current={open === c.id ? 'true' : undefined}
                // The tab's name is its number and state; the chapter's title is its description (so a search for a
                // chapter's title finds its card, the button that starts it).
                aria-label={`Chapter ${i + 1}${st === 'done' ? ', won' : st === 'locked' ? ', not yet open' : ''}`}
                title={c.title}
                onClick={() => pick(c.id)}
              >
                {/* Plan item 415: each tab is a print of its chapter's own scene (dusk for a locked one), the number
                    on a medallion at its foot, so the six read as six places, not six chips. */}
                <ChapterVignette chapter={c} state={st} mini />
                <span className="cmp-tab-num" aria-hidden="true">
                  {st === 'done' ? (
                    <svg viewBox="-8 -8 16 16">
                      <path d="M-4.5 0.5 L-1.2 3.8 L4.8 -3.2" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
              </button>
            )
          })}
        </nav>
      )}
      <ol
        className="chapter-list cmp-path"
        ref={listRef}
        onScroll={(e) => {
          // Plan item 386: a swipe through the phone's carousel opens the card it settles on.
          if (!phone) return
          const list = e.currentTarget
          const i = Math.round(list.scrollLeft / Math.max(1, list.clientWidth))
          const id = chapters[Math.max(0, Math.min(chapters.length - 1, i))]!.id
          if (id !== open && Math.abs(list.scrollLeft - i * list.clientWidth) < 4) setPicked(id)
        }}
        onKeyDown={(e) => {
          // Plan item 373: the arrow keys step between the chapters (Enter or Space then starts the focused one).
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          const cards = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.cmp-card')]
          const at = cards.indexOf(document.activeElement as HTMLButtonElement)
          if (at < 0) return
          const to = cards[Math.max(0, Math.min(cards.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
          if (to && to !== cards[at]) {
            e.preventDefault()
            to.focus()
          }
        }}
      >
        {chapters.map((chapter, i) => {
          const isDone = completed.includes(chapter.id)
          const previous = chapters[i - 1]
          const locked = i > 0 && !isDone && !!previous && !completed.includes(previous.id)
          const current = !isDone && !locked && !currentMarked
          if (current) currentMarked = true
          // Chapter 1's coach is the first-time tutorial; a later chapter's coach is a quieter walkthrough.
          const first = i === 0
          const coached = first ? tutorialDone : (coachDone?.(chapter.id) ?? true)
          const state = isDone ? 'done' : locked ? 'locked' : 'current'
          return (
            <li key={chapter.id} className={`cmp-stop cmp-stop-${state}${current ? ' cmp-stop-next' : ''}${phone && open === chapter.id ? ' is-open' : ''}${!phone && pointed === chapter.id ? ' is-linked' : ''}`} data-chapter={chapter.id}>
              <Medallion n={i + 1} state={state} />
              <button
                className={`cmp-card ${isDone ? 'chapter-completed' : locked ? 'chapter-locked' : ''}`}
                onClick={() => start(chapter)}
                onPointerEnter={() => setHovered(chapter.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setFocused(chapter.id)}
                onBlur={() => setFocused(null)}
              >
                {/* Plan item 415: the chapter a win just opened is tied with the co-op's ribbon, cut as Cath walks to its
                    stop (the map's moment): its two ends spring apart and drop away (a fade under reduced motion). */}
                {celebrate && current && completed.includes(celebrate) && (
                  <span className="cmp-ribbon" data-ribbon={chapter.id} aria-hidden="true">
                    <i className="cmp-ribbon-end is-l" />
                    <i className="cmp-ribbon-end is-r" />
                  </span>
                )}
                <span className="cmp-card-text">
                  <span className="cmp-chapter-no" aria-hidden="true">Chapter {i + 1}</span>
                  <strong className="cmp-title">
                    {chapter.title}
                    <span className="sr-only">{isDone ? ' (completed)' : locked ? ' (locked)' : ''}</span>
                  </strong>
                  <span className="chapter-goal" title={chapter.goalDescription}>{chapter.goalDescription}</span>
                </span>
                <span className="cmp-card-foot">
                  <span className="cmp-cast" aria-hidden="true">
                    {chapter.producers.map((p) => (
                      <span key={p} className="cmp-face">
                        <Portrait character={p} size={30} />
                      </span>
                    ))}
                    {isDone && <span className="cmp-badge">Completed</span>}
                    {current && chapter.guided && !coached && <span className="cmp-badge cmp-badge-next">{first ? 'Tutorial' : 'Cath shows you'}</span>}
                    {current && !(chapter.guided && !coached) && <span className="cmp-badge cmp-badge-next">Up next</span>}
                  </span>
                  <WaxSeals chapter={chapter} earned={seals?.(chapter.id) ?? (isDone ? ['win'] : [])} />
                  {/* The card is the button: this says so, in the look of a real key. */}
                  {(current || isDone) && (
                    <span className={current ? 'cmp-cta cmp-cta-primary' : 'cmp-cta'} aria-hidden="true">
                      {current ? (first && chapter.guided && !coached ? 'Start here' : 'Play') : 'Play again'}
                      <svg viewBox="0 0 16 16" width="14" height="14">
                        <path d="M5 3l5 5-5 5" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="cmp-art">
                  <ChapterVignette chapter={chapter} state={state} />
                  <MiniMap chapter={chapter} />
                </span>
              </button>
              {((isDone && onStartHard && hasHardSeal(chapter.id)) || (chapter.guided && coached && onReplayTutorial)) && (
                <span className="cmp-replays">
                {isDone && onStartHard && hasHardSeal(chapter.id) && (
                  <button className="btn-quiet cmp-replay cmp-hard" onClick={() => onStartHard(chapter)}>
                    Play on Hard
                  </button>
                )}
                {chapter.guided && coached && onReplayTutorial && (
                  <button className="btn-quiet cmp-replay" onClick={() => onReplayTutorial(chapter)}>
                    {first ? 'Replay the tutorial' : 'Replay the walkthrough'}
                  </button>
                )}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <button className="cmp-back" onClick={onBack}>
        Back to Title
      </button>
    </main>
  )
}
