import { useId } from 'react'
import type { ExecMood } from '../boardroom'

/**
 * Plan item 414: Hollowell's face in Hollowell's own style: no ink outline, glossy gradients and hard specular
 * highlights, a pastel-plastic palette (VISION: the corporations glossy, plastic, over-lit and clinical).
 *
 * Plan item 467: Graham Pell drawn to Cath's standard. Layered silver hair with a shine band and a side parting,
 * a shaded, jowly face lit from the upper left, hooded eyes behind rimless glasses, a navy suit with notched
 * lapels, Hollowell's orange tie and a lapel pin. Five poses keyed to the table (`PellPose`): smug, gloating,
 * scheming (fingers steepled), rattled and defeated (head down, tie loosened). He blinks and straightens his tie
 * when idle; a pose change eases over 250 ms with no overshoot, and reduced motion only cross-fades (table.css).
 *
 * `crop` frames him: `bust` is head and shoulders for the desktop's medallion, `face` the head alone for a
 * phone's 56 px medallion (the head ≥ 52 px there).
 */
export type PellPose = ExecMood | 'scheme' | 'defeated'

const BROWS: Record<PellPose, string> = {
  smug: 'M43 42q6-5 13-2M64 40q7-3 13 0',
  gloat: 'M41 37q8-8 15-2M64 35q7-7 15 1',
  scheme: 'M43 45q7-2 13 1M64 39q7-6 13 0',
  rattled: 'M43 42q7 0 12-4M65 38q5 4 12 4',
  defeated: 'M43 41q7 2 12 0M65 41q5-2 12 0',
}

/** The upper lids: how far each hooded lid comes down over the eye (0 open, 1 shut). */
const LIDS: Record<PellPose, [number, number]> = {
  smug: [0.45, 0.35],
  gloat: [0.12, 0.12],
  scheme: [0.62, 0.3],
  rattled: [0.05, 0.05],
  defeated: [0.8, 0.8],
}

/** Where his eyes look, as an offset of the irises. */
const GAZE: Record<PellPose, [number, number]> = {
  smug: [0.6, 0],
  gloat: [0, -0.2],
  scheme: [2.1, 0.2],
  rattled: [-0.8, 0],
  defeated: [0, 1.4],
}

function Mouth({ pose }: { pose: PellPose }) {
  switch (pose) {
    case 'smug':
      return (
        <>
          <path d="M51 70q9 3 18-3" fill="none" stroke="#97534a" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M68 66.5q2 0 2.5 2" fill="none" stroke="#b9786a" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )
    case 'gloat':
      return (
        <>
          <path d="M48 66q12 12 24 0q-12 3-24 0Z" fill="#6e2f2a" />
          <path d="M49.5 66.4q10.5 2.8 21 0l-1 2.4q-9.5 2-19 0Z" fill="#fbfbf8" />
          <path d="M48 66q12 12 24 0" fill="none" stroke="#97534a" strokeWidth="2" strokeLinecap="round" />
        </>
      )
    case 'scheme':
      return <path d="M52 69q4 1.5 8 0.5q5-1 9-3.5" fill="none" stroke="#97534a" strokeWidth="2.1" strokeLinecap="round" />
    case 'rattled':
      return (
        <>
          <path d="M53 71q3-3.5 7-3.5q4 0 7 3.5q-3.5 1.6-7 1.6q-3.5 0-7-1.6Z" fill="#6e2f2a" />
          <path d="M53 71q3-3.5 7-3.5q4 0 7 3.5" fill="none" stroke="#97534a" strokeWidth="1.6" strokeLinecap="round" />
        </>
      )
    case 'defeated':
      return <path d="M51 72q9-5 18 0" fill="none" stroke="#97534a" strokeWidth="2.2" strokeLinecap="round" />
  }
}

function Eye({ cx, pose, lid, id }: { cx: number; pose: PellPose; lid: number; id: string }) {
  const [gx, gy] = GAZE[pose]
  // The lid's lower edge, from fully open (y 48) to shut (y 54.5).
  const edge = 48 + lid * 6.5
  return (
    <g>
      <ellipse cx={cx} cy="51.5" rx="4.6" ry="3.2" fill="#f6f3ee" />
      <circle cx={cx + gx} cy={51.6 + gy} r="2.3" fill="#4a6078" />
      <circle cx={cx + gx} cy={51.6 + gy} r="1.15" fill="#1b2433" />
      <circle cx={cx + gx - 0.8} cy={50.8 + gy} r="0.6" fill="#fff" />
      {/* the hooded upper lid, skin-coloured, its fold above */}
      <path d={`M${cx - 5.6} 47.6Q${cx} 45.4 ${cx + 5.6} 47.6L${cx + 5.6} ${edge}Q${cx} ${edge + 1.6} ${cx - 5.6} ${edge}Z`} fill={`url(#${id}-lid)`} />
      <path d={`M${cx - 5} ${edge + 0.2}Q${cx} ${edge + 1.8} ${cx + 5} ${edge + 0.2}`} fill="none" stroke="#7d5a4f" strokeWidth="1.1" strokeLinecap="round" />
      {/* the bag under the eye */}
      <path d={`M${cx - 4} 55.6q4 1.8 8 0`} fill="none" stroke="#c99a86" strokeWidth=".9" strokeLinecap="round" opacity=".8" />
      {/* the blink: a whole lid that drops shut for a moment (table.css .pell-blink) */}
      <path className="pell-blink" d={`M${cx - 5.6} 47.6Q${cx} 45.4 ${cx + 5.6} 47.6L${cx + 5.6} 54.6Q${cx} 56 ${cx - 5.6} 54.6Z`} fill={`url(#${id}-lid)`} />
    </g>
  )
}

export default function ExecPortrait({ mood, title, crop = 'bust' }: { mood: PellPose; title?: string; crop?: 'bust' | 'face' }) {
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `url(#${id}-${n})`
  const [lidL, lidR] = LIDS[mood]
  const viewBox = crop === 'face' ? '25 16 70 70' : '18 14 84 84'
  return (
    <svg className="exec-portrait" viewBox={viewBox} role="img" aria-label={title} data-mood={mood} data-pell-pose={mood} data-crop={crop}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe7da" />
          <stop offset=".5" stopColor="#efcab4" />
          <stop offset="1" stopColor="#cf9f89" />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9bfa9" />
          <stop offset="1" stopColor="#dcab95" />
        </linearGradient>
        <radialGradient id={`${id}-jowl`} cx=".5" cy=".3" r=".7">
          <stop offset="0" stopColor="#b98370" stopOpacity="0" />
          <stop offset="1" stopColor="#b98370" stopOpacity=".55" />
        </radialGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef1f6" />
          <stop offset=".55" stopColor="#bcc4ce" />
          <stop offset="1" stopColor="#848e9b" />
        </linearGradient>
        <linearGradient id={`${id}-hairback`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9aa4b1" />
          <stop offset="1" stopColor="#5f6875" />
        </linearGradient>
        <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#40577e" />
          <stop offset=".6" stopColor="#25344f" />
          <stop offset="1" stopColor="#161f33" />
        </linearGradient>
        <linearGradient id={`${id}-lapel`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4c6590" />
          <stop offset="1" stopColor="#2a3a58" />
        </linearGradient>
        <linearGradient id={`${id}-tie`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffa25a" />
          <stop offset=".5" stopColor="#f47a28" />
          <stop offset="1" stopColor="#d65a16" />
        </linearGradient>
        <linearGradient id={`${id}-hand`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6d6c4" />
          <stop offset="1" stopColor="#d9a891" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx=".38" cy=".3" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* the suit: shoulders, shirt, notched lapels, the tie (it straightens itself, .pell-tie) and the pin */}
      <g className="pell-body">
        <path d="M10 124q1-27 27-34l23 9 23-9q26 7 27 34Z" fill={g('suit')} />
        <path d="M30 98q6-4 12-5M90 98q-6-4-12-5" fill="none" stroke="#5f7aa3" strokeWidth="1.2" opacity=".55" />
        <path d="M47 89l13 15 13-15-4-5H51Z" fill="#f5f8fc" />
        <path d="M52 86l8 9 8-9" fill="none" stroke="#d3dbe6" strokeWidth="1.2" />
        <g className={`pell-tie${mood === 'defeated' ? ' pell-tie-loose' : ''}`}>
          <path d="M56.6 91.5h6.8l1.6 3.4-1.6 1.4h-6.8l-1.6-1.4Z" fill={g('tie')} />
          <path d="M57.4 96.2h5.2l2.6 20-5.2 5-5.2-5Z" fill={g('tie')} />
          <path d="M58.6 97l-1.4 17" stroke="#ffd2a8" strokeWidth=".9" opacity=".7" />
          <path d="M55.6 106h8.8" stroke="#e8edf3" strokeWidth="1.3" />
        </g>
        <path d="M37 90l17 18-3 3-9-5 3-3-12-10Z" fill={g('lapel')} />
        <path d="M83 90l-17 18 3 3 9-5-3-3 12-10Z" fill={g('lapel')} />
        <path d="M38 91l14 15M82 91l-14 15" stroke="#7d95bd" strokeWidth=".8" opacity=".6" />
        <circle cx="76" cy="101" r="2.7" fill="#ff8a3a" />
        <path d="M74.8 99.8v2.4M77.2 99.8v2.4M74.8 101h2.4" stroke="#fff" strokeWidth=".7" />
        <circle cx="75.5" cy="100" r=".8" fill="#fff" opacity=".8" />
      </g>

      <g className="pell-head">
        {/* the hair behind, darker; neck and ears */}
        <path d="M35 52c-2-10 0-20 6-26l38 0c6 6 8 16 6 26q-2 6-4 8l-42 0q-2-2-4-8Z" fill={g('hairback')} />
        <path d="M49 76h22v14q-11 6-22 0Z" fill="#d6a690" />
        <path d="M49 80q11 6 22 0" fill="none" stroke="#bb8a75" strokeWidth="1.2" opacity=".7" />
        <path d="M36 50q-6 0-5 7q1 6 6 6Z" fill="#e3b49e" />
        <path d="M84 50q6 0 5 7q-1 6-6 6Z" fill="#d6a18b" />
        <path d="M34 53q1 4 3 5M86 53q-1 4-3 5" fill="none" stroke="#b9826d" strokeWidth=".9" />

        {/* the face: broad at the jaw, jowls softening the line, lit from the upper left */}
        <path className="pell-face" d="M60 22c14 0 24 10 24 27c0 10-1 17-4 22c-3 7-11 13-20 13s-17-6-20-13c-3-5-4-12-4-22c0-17 10-27 24-27Z" fill={g('skin')} />
        <path d="M38 66c3 9 11 17 22 17s19-8 22-17c-2 4-6 9-12 11c-3 1-7 1.5-10 1.5s-7-.5-10-1.5c-6-2-10-7-12-11Z" fill={g('jowl')} />
        <path d="M74 44q8 6 7 22q-2 8-8 11q4-12 1-33Z" fill="#c4917c" opacity=".35" />
        <ellipse cx="51" cy="37" rx="12" ry="8" fill={g('shine')} />
        <ellipse cx="46" cy="62" rx="5" ry="3" fill="#e9a08c" opacity=".16" />
        <ellipse cx="74" cy="62" rx="5" ry="3" fill="#d98e7b" opacity=".16" />
        <path d="M53 63q-3 3-1 7M67 63q3 3 1 7" fill="none" stroke="#c0907b" strokeWidth="1" strokeLinecap="round" opacity=".75" />
        <ellipse cx="58" cy="80" rx="4" ry="1.8" fill="#fff" opacity=".22" />
        <path d="M42 70q4 8 11 11" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".18" />
        <path d="M56 79q4 1.5 8 0" fill="none" stroke="#c0907b" strokeWidth="1" strokeLinecap="round" opacity=".6" />

        {/* silver hair, combed back from a side parting, in layers, with a gloss band across the crown */}
        <path className="pell-hair" d="M35 50c-3-19 7-31 25-31c16 0 26 10 25 29c-2-8-6-14-12-17c-10 1-20 0-29 3c-5 3-8 9-9 16Z" fill={g('hair')} />
        <path d="M44 28c6-5 16-6 24-3c5 2 9 5 12 9c-6-4-14-6-22-5c-6 0-10 0-14-1Z" fill="#f4f6fa" opacity=".8" />
        <path d="M45 24q-6 6-8 15M52 21q-6 4-9 10M66 21q8 3 13 11M71 24q6 5 9 13" fill="none" stroke="#8d97a4" strokeWidth=".9" strokeLinecap="round" opacity=".7" />
        <path d="M41 33q14-11 33-7" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".38" />
        <path d="M47 28.5q9-4 18-3" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".9" />
        <path d="M47 23q-3 3-4 7" fill="none" stroke="#6e7886" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M36 46q-1 5 0 9M84 46q1 5 0 9" fill="none" stroke="#cfd5dd" strokeWidth="2" strokeLinecap="round" />
        {mood === 'defeated' && <path d="M50 26q-4 8-1 14" fill="none" stroke="#bcc4ce" strokeWidth="1.6" strokeLinecap="round" />}

        {/* the pose's features: brows, eyes, mouth; re-keyed so each change fades in (table.css .pell-feat) */}
        <g className="pell-feat" key={mood}>
          <path d={BROWS[mood]} fill="none" stroke="#7f8996" strokeWidth="2.8" strokeLinecap="round" />
          <Eye cx={50} pose={mood} lid={lidL} id={id} />
          <Eye cx={70} pose={mood} lid={lidR} id={id} />
          <Mouth pose={mood} />
          {mood === 'rattled' && <path d="M82 36q3.2 5 0 7.4q-3.2-2.4 0-7.4Z" fill="#bfe4ff" />}
          {mood === 'defeated' && <path d="M40 38q3 5 0 7q-3-2 0-7Z" fill="#bfe4ff" />}
        </g>

        {/* rimless glasses: faint lenses, a bridge and a hard glint */}
        <rect x="41.5" y="45" width="17" height="12.5" rx="4" fill="#e6f3ff" fillOpacity=".1" stroke="#aeb9c6" strokeWidth=".8" />
        <rect x="61.5" y="45" width="17" height="12.5" rx="4" fill="#e6f3ff" fillOpacity=".1" stroke="#aeb9c6" strokeWidth=".8" />
        <path d="M58.5 49.5q1.5-1 3 0M41.5 49l-5-1M78.5 49l5-1" fill="none" stroke="#b9c3cf" strokeWidth="1.2" />
        <path d="M43.4 46.8q1.6-.8 3.4-.6M63.4 46.8q1.6-.8 3.4-.6" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".95" />

        {/* the nose: a lit ridge and a shaded side */}
        <path d="M61 52q-1 6-3 10q2 2 5 1" fill="none" stroke="#c4937f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M60.5 54q-.5 4 .5 7" fill="none" stroke="#fff" strokeWidth="1" strokeLinecap="round" opacity=".5" />
        <path d="M62 52q2 6 1.5 10.5q2.5-.5 3.5-2q-2-3-5-8.5Z" fill="#b98370" opacity=".35" />
      </g>

      {/* scheming: fingers steepled under his chin */}
      {mood === 'scheme' && (
        <g className="pell-feat pell-hands">
          <path d="M40 124l6-28q2-4 6-3l5 4-3 27Z" fill={g('suit')} />
          <path d="M80 124l-6-28q-2-4-6-3l-5 4 3 27Z" fill={g('suit')} />
          <path d="M49 93q2-13 10-19q1-.5 2 0q8 6 10 19q-5 3-11 3q-6 0-11-3Z" fill={g('hand')} />
          <path d="M60 75l0 19M56 78l-2.5 13M64 78l2.5 13M52.5 85l-1.5 6M67.5 85l1.5 6" fill="none" stroke="#c08b76" strokeWidth=".9" strokeLinecap="round" />
          <path d="M57 76q3-2 6 0" fill="none" stroke="#fff" strokeWidth=".9" strokeLinecap="round" opacity=".6" />
          <path d="M48 93q12 5 24 0" fill="none" stroke="#f7f9fc" strokeWidth="2.6" />
        </g>
      )}
    </svg>
  )
}
