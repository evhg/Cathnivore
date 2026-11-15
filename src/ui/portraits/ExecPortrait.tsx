import { useId } from 'react'
import type { ExecMood } from '../boardroom'

/**
 * Plan item 414: Hollowell's face in Hollowell's own style. Graham Pell was drawn in the players' hand (ink line,
 * warm skin, the producers' figure kit), so across the table he read as one of them (critique 2026-11-15: 'looks
 * like Mara'). Here he is the corporation's: no ink outline, glossy gradients and hard specular highlights, a
 * pastel-plastic palette (VISION: the corporations glossy, plastic, over-lit and clinical), silver hair slicked
 * back, rimless glasses, a navy suit with Hollowell's orange tie. Head and shoulders in a 120 box, for a round frame.
 */
export default function ExecPortrait({ mood, title }: { mood: ExecMood; title?: string }) {
  const id = useId().replace(/:/g, '')
  const g = (n: string) => `url(#${id}-${n})`
  const brows: Record<ExecMood, string> = {
    // smug: one brow up; gloat: both up and arched; rattled: knotted, inner ends raised
    smug: 'M44 42q6-4 12-1M64 39q6-2 12 1',
    gloat: 'M43 40q7-5 13-1M64 39q6-4 13 1',
    rattled: 'M44 41q6 0 11-3M65 38q5 3 11 3',
  }
  const mouth: Record<ExecMood, JSX.Element> = {
    smug: <path d="M51 70q8 4 17-2" fill="none" stroke="#9c5a50" strokeWidth="2.4" strokeLinecap="round" />,
    gloat: (
      <>
        <path d="M49 67q11 10 22 0q-11 4-22 0Z" fill="#fbfbf8" />
        <path d="M49 67q11 10 22 0" fill="none" stroke="#9c5a50" strokeWidth="2.2" strokeLinecap="round" />
      </>
    ),
    rattled: <ellipse cx="60" cy="70" rx="4.5" ry="3.2" fill="#7a3e38" />,
  }
  return (
    <svg className="exec-portrait" viewBox="14 12 92 92" role="img" aria-label={title} data-mood={mood}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fbe9dd" />
          <stop offset=".55" stopColor="#efcdb8" />
          <stop offset="1" stopColor="#d6a994" />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4f6fa" />
          <stop offset=".5" stopColor="#c3cad3" />
          <stop offset="1" stopColor="#8e98a4" />
        </linearGradient>
        <linearGradient id={`${id}-suit`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4f73" />
          <stop offset="1" stopColor="#1c2840" />
        </linearGradient>
        <linearGradient id={`${id}-tie`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff9a4a" />
          <stop offset="1" stopColor="#e3631c" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx=".38" cy=".3" r=".5">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* shoulders: the suit, the shirt's V, the tie and the company pin */}
      <path d="M14 120q2-26 26-32l20 10 20-10q24 6 26 32Z" fill={g('suit')} />
      <path d="M48 90l12 14 12-14-4-4H52Z" fill="#f7f9fc" />
      <path d="M57 94h6l2 4-3 16h-4l-3-16Z" fill={g('tie')} />
      <path d="M40 88l14 18-4 4-14-16ZM80 88l-14 18 4 4 14-16Z" fill="#2c3d5c" />
      <circle cx="80" cy="102" r="2.6" fill="#ff8a3a" />
      <path d="M38 96q6-3 12-1" fill="none" stroke="#5f7aa3" strokeWidth="1.4" opacity=".7" />
      {/* neck and head, the plastic skin lit from the upper left */}
      <path d="M50 78h20v12q-10 6-20 0Z" fill="#d9ad98" />
      <ellipse cx="38" cy="55" rx="4" ry="6" fill="#e6bba6" />
      <ellipse cx="82" cy="55" rx="4" ry="6" fill="#e6bba6" />
      <path d="M60 22c14 0 23 11 23 28c0 18-9 32-23 32s-23-14-23-32c0-17 9-28 23-28Z" fill={g('skin')} />
      <ellipse cx="52" cy="40" rx="13" ry="9" fill={g('shine')} />
      {/* silver hair, slicked back, with a hard gloss streak */}
      <path d="M36 48c-2-18 8-30 25-30c15 0 25 10 24 28c-3-9-9-15-18-16c-9 3-20 3-31 18Z" fill={g('hair')} />
      <path d="M46 26q12-6 26-1" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
      {/* brows, rimless glasses with a glint, the eyes behind */}
      <path d={brows[mood]} fill="none" stroke="#8e98a4" strokeWidth="2.6" strokeLinecap="round" />
      <ellipse cx="50" cy="51" rx="2.6" ry={mood === 'gloat' ? 1.4 : 2.4} fill="#33435c" />
      <ellipse cx="70" cy="51" rx="2.6" ry={mood === 'gloat' ? 1.4 : 2.4} fill="#33435c" />
      <rect x="41" y="44" width="17" height="13" rx="4" fill="#dff0ff" opacity=".28" />
      <rect x="62" y="44" width="17" height="13" rx="4" fill="#dff0ff" opacity=".28" />
      <path d="M58 49h4" stroke="#b9c3cf" strokeWidth="1.6" />
      <path d="M44 46l5 4M65 46l5 4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".9" />
      {/* nose, a shade, and the mouth for his mood */}
      <path d="M60 52q-3 9 0 12" fill="none" stroke="#c99883" strokeWidth="2" strokeLinecap="round" />
      {mouth[mood]}
      {mood === 'rattled' && <path d="M80 36q3 5 0 7q-3-2 0-7Z" fill="#bfe4ff" />}
    </svg>
  )
}
