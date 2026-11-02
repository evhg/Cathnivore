import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import type { RegionId } from '../engine/types'
import Portrait from './portraits/Portrait'
import CathArt from './CathArt'
import CampaignMap from './CampaignMap'
import { CHAPTER_SEALS, hasHardSeal } from '../content/campaignMap'
import { SCREEN_POSE } from '../../shared/cath/screenposes'

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

// ROADMAP 149: a small drawn scene along the foot of each chapter card (hills plus one motif).
const SCENE_MOTIFS = [
  <path key="barn" d="M20 40v-14l9-7 9 7v14zM24 40v-7h10v7z" />,
  <path key="stall" d="M18 40V28h24v12zM15 28l5-8h20l5 8z" />,
  <path key="rows" d="M10 40l12-14M20 40l12-14M30 40l12-14M40 40l12-14" strokeWidth="2.5" fill="none" stroke="currentColor" />,
  <path key="mill" d="M28 40V26h6v14zM31 26l-9-9M31 26l9-9M31 26l-9 9M31 26l9 9" strokeWidth="2.5" stroke="currentColor" />,
  <path key="boat" d="M14 36h32l-6 6H20zM30 36V20l10 14z" />,
  <path key="clock" d="M26 40V16h8v24zM24 16l6-7 6 7z" />,
]
function ChapterScene({ index, tint }: { index: number; tint?: string }) {
  return (
    <svg className={tint ? `cmp-scene cmp-scene-${tint}` : 'cmp-scene'} viewBox="0 0 120 44" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <path d="M0 44V30q20-12 40 0t40-4 40 6v12z" opacity="0.5" />
      <path d="M0 44V36q30-10 60 0t60-4v12z" opacity="0.8" />
      <g transform={`translate(${46 + (index % 2) * 6} 0)`}>{SCENE_MOTIFS[index % SCENE_MOTIFS.length]}</g>
    </svg>
  )
}

export default function CampaignScreen({
  chapters,
  completed,
  tutorialDone = true,
  coachDone,
  seals,
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
  onStartHard?: (chapter: Chapter) => void
  onStart: (chapter: Chapter) => void
  onReplayTutorial?: (chapter: Chapter) => void
  onBack: () => void
}) {
  const done = chapters.filter((c) => completed.includes(c.id)).length
  let currentMarked = false
  return (
    <main className="campaign campaign-screen">
      <header className="cmp-header">
        <div className="cmp-header-text">
          <p className="cmp-kicker">The liberation of Marrow</p>
          <h1>Campaign</h1>
          <p className="cmp-progress">
            {done} of {chapters.length} chapters
            <span className="cmp-progress-bar" aria-hidden="true">
              <span className={`cmp-progress-fill cmp-fill-${done}`} />
            </span>
          </p>
        </div>
        {/* ROADMAP "Cath on the title, Campaign, setup and end screens with a matching expression":
            delighted once every chapter is done, her default warm smirk otherwise. */}
        <CathArt
          className="cmp-header-cath"
          framing="bust"
          pose={SCREEN_POSE['cathnivore:campaign']}
          expression={done === chapters.length ? 'delighted' : 'smirk'}
          animate
          width={84}
          height={84}
          title="Cath"
        />
      </header>
      <CampaignMap chapters={chapters} completed={completed} onStart={onStart} />
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
              >
                <span className="cmp-card-text">
                  <span className="cmp-chapter-no" aria-hidden="true">Chapter {i + 1}</span>
                  <strong className="cmp-title">
                    {chapter.title}
                    <span className="sr-only">{isDone ? ' (completed)' : locked ? ' (locked)' : ''}</span>
                  </strong>
                  <span className="chapter-goal">{chapter.goalDescription}</span>
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
                <ChapterScene index={i} tint={isDone ? REGIONS[chapter.activeRegions[0]!].type : undefined} />
                <MiniMap chapter={chapter} />
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
