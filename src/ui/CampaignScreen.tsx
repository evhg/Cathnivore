import type { Chapter } from '../content/chapters'
import { REGIONS } from '../content/map'
import type { RegionId } from '../engine/types'
import Portrait from './portraits/Portrait'
import CathArt from './CathArt'

// SPEC 10.1 campaign screen, drawn as a journey across Marrow (ROADMAP 9): each chapter is a stop on a
// path, with a mini map of the regions it plays on and the producers who play it. Locked chapters stay
// clickable (SPEC 8.1: "Progress is never locked"); the lock is only a hint.
//
// Test hooks: each chapter is a button whose accessible name starts with the chapter title and includes
// "(completed)" or "(locked)" (e2e/chapter-resume.spec.ts and others rely on this).

const R = 10
const W = R * Math.sqrt(3)
const AXIAL: Record<RegionId, [number, number]> = {
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
        const [q, r] = AXIAL[id]
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
function ChapterScene({ index }: { index: number }) {
  return (
    <svg className="cmp-scene" viewBox="0 0 120 44" preserveAspectRatio="xMaxYMax slice" aria-hidden="true">
      <path d="M0 44V30q20-12 40 0t40-4 40 6v12z" opacity="0.5" />
      <path d="M0 44V36q30-10 60 0t60-4v12z" opacity="0.8" />
      <g transform={`translate(${46 + (index % 2) * 6} 0)`}>{SCENE_MOTIFS[index % SCENE_MOTIFS.length]}</g>
    </svg>
  )
}

export default function CampaignScreen({
  chapters,
  completed,
  onStart,
  onBack,
}: {
  chapters: Chapter[]
  completed: string[]
  onStart: (chapter: Chapter) => void
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
          expression={done === chapters.length ? 'delighted' : 'smirk'}
          animate
          width={84}
          height={84}
          title="Cath"
        />
      </header>
      <ol className="chapter-list cmp-path">
        {chapters.map((chapter, i) => {
          const isDone = completed.includes(chapter.id)
          const previous = chapters[i - 1]
          const locked = i > 0 && !isDone && !!previous && !completed.includes(previous.id)
          const current = !isDone && !locked && !currentMarked
          if (current) currentMarked = true
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
                    {current && <span className="cmp-badge cmp-badge-next">Up next</span>}
                  </span>
                </span>
                <ChapterScene index={i} />
                <MiniMap chapter={chapter} />
              </button>
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
