import { useMedia } from './useMedia'
import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import type { RegionId } from '../engine/types'
import Portrait from './portraits/Portrait'
import CathArt from './CathArt'
import CampaignMap from './CampaignMap'
import { CHAPTER_HOMES, CHAPTER_SEALS, MAP_AXIAL, hasHardSeal, liberatedRegions } from '../content/campaignMap'
import { LANDMARKS } from '../content/campaignMapLayout'
import { Landmark } from './Landmark'
import { SCREEN_POSE } from '../../shared/cath/screenposes'
import { useState } from 'react'
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
function ChapterVignette({ chapter, state }: { chapter: Chapter; state: 'locked' | 'current' | 'done' }) {
  const locked = state === 'locked'
  const producer = chapter.producers[0]
  const regions = vignetteRegions(chapter)
  const homes = new Set(CHAPTER_HOMES[chapter.id] ?? [])
  const n = regions.length
  const slot = VIG_W / n
  return (
    <svg
      className={locked ? 'cmp-vignette is-sealed' : state === 'done' ? 'cmp-vignette is-won' : 'cmp-vignette'}
      viewBox={`0 0 ${VIG_W} ${VIG_H}`}
      data-regions={regions.join(' ')}
      data-chapter-art={state}
      aria-hidden="true"
    >
      <rect className="cmp-vig-sky" x={0} y={0} width={VIG_W} height={VIG_H} />
      <circle className="cmp-vig-sun" cx={18} cy={15} r={7} />
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
      {/* The producer at their stall, front right: a striped awning over a counter, their bust behind it. */}
      {producer && (
        <g className="cmp-vig-stall" transform={`translate(${VIG_W - 34} ${VIG_H - 33})`}>
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
            return <path key={`ray-${k}`} className="cmp-vig-ray" d={`M${(18 + Math.cos(a) * 9).toFixed(1)} ${(15 + Math.sin(a) * 9).toFixed(1)} L${(18 + Math.cos(a) * 12).toFixed(1)} ${(15 + Math.sin(a) * 12).toFixed(1)}`} />
          })}
        </g>
      )}
      {/* Plan item 279: a locked chapter's scene waits at dusk under the co-op's wax seal: its land in colour, its
          landmarks and stall in silhouette, a seal pressed with a leaf at its heart. */}
      {locked && (
        <g className="cmp-vig-seal" transform={`translate(${VIG_W / 2 - 8} ${VIG_H / 2 + 2})`}>
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
  const say = campaignLine(pointed ?? next?.id, done === chapters.length)
  const wide = useMedia('(min-width: 1100px)')
  // Plan item 248: Cath hosts the map at full height, head to boots, with her line over her head. On a desktop she
  // stands on a jetty in the map's own sea beside the island; on a phone she stands beside her line in the header.
  // One copy in the DOM (mounted by viewport), so `.cmp-cath` and its line stay single for tests and screen readers.
  const host = (
    <figure className="cmp-cath" data-chapter={pointed ?? next?.id ?? 'done'} data-host={wide ? 'map' : 'header'}>
      <p className="cmp-cath-line" aria-live="polite">
        {say.line}
      </p>
      <span className="cmp-host-stand">
        <CathArt
          className="cmp-header-cath"
          framing="full"
          pose={SCREEN_POSE['cathnivore:campaign']}
          expression={say.expression}
          animate
          title="Cath"
        />
        {wide && (
          <svg className="cmp-host-jetty" viewBox="0 0 120 34" aria-hidden="true">
            <path className="cmp-jetty-post" d="M14 14 V32 M106 14 V32 M60 16 V33" />
            <path className="cmp-jetty-deck" d="M4 8 H116 L112 18 H8 Z" />
            <path className="cmp-jetty-plank" d="M22 8 L21 18 M40 8 L39.5 18 M58 8 V18 M76 8 L76.5 18 M94 8 L95 18" />
            <path className="cmp-jetty-ripple" d="M0 30 q6 -3 12 0 t12 0 M96 31 q6 -3 12 0 t12 0" />
          </svg>
        )}
      </span>
    </figure>
  )
  return (
    <main className="campaign campaign-screen">
      <header className="cmp-header">
        <div className="cmp-header-text">
          <p className="cmp-kicker">The liberation of Marrow</p>
          <h1>Campaign</h1>
          <p className="cmp-progress">
            {/* The map has seven regions and chapter 1 frees two, so the header counts both (critique 2026-11-03). */}
            <span className="cmp-progress-text">
              {done} of {chapters.length} chapters
              <span className="cmp-progress-regions">
                {' · '}
                {liberatedRegions(completed).size} of {Object.keys(MAP_AXIAL).length} regions free
              </span>
            </span>
            <span className="cmp-progress-bar" aria-hidden="true">
              <span className={`cmp-progress-fill cmp-fill-${done}`} />
            </span>
          </p>
        </div>
        {!wide && host}
      </header>
      <CampaignMap chapters={chapters} completed={completed} onStart={onStart} celebrate={celebrate} lit={pointed ?? undefined} host={wide ? host : undefined} />
      {/* Plan item 257: on a desktop the campaign's tally sits under the map, filling the band the map leaves; the
          page's own Back sits under the rail, which scrolls on a tall desktop, so there it lives here. */}
      {wide && (
        <div className="cmp-ledger" data-ledger>
          <dl className="cmp-ledger-cells">
            <div className="cmp-ledger-cell">
              <dt>Chapters won</dt>
              <dd>
                <b>{done}</b> of {chapters.length}
              </dd>
            </div>
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
      <ol className="chapter-list cmp-path">
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
            <li key={chapter.id} className={`cmp-stop cmp-stop-${state}${current ? ' cmp-stop-next' : ''}`}>
              <Medallion n={i + 1} state={state} />
              <button
                className={`cmp-card ${isDone ? 'chapter-completed' : locked ? 'chapter-locked' : ''}`}
                onClick={() => onStart(chapter)}
                onPointerEnter={() => setHovered(chapter.id)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setFocused(chapter.id)}
                onBlur={() => setFocused(null)}
              >
                <span className="cmp-card-text">
                  <span className="cmp-chapter-no" aria-hidden="true">Chapter {i + 1}</span>
                  <strong className="cmp-title">
                    {chapter.title}
                    <span className="sr-only">{isDone ? ' (completed)' : locked ? ' (locked)' : ''}</span>
                  </strong>
                  <span className="chapter-goal">{chapter.goalDescription}</span>
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
