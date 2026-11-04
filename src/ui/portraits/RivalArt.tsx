import { useId } from 'react'
import type { RivalFace } from './rivalFace'

// Plan item 92: Julian Crisp, Hollowell's face, drawn to the producers' level (ProducerArt.tsx) but in the
// corporations' language (VISION: glossy, plastic, over-lit): lacquered hair with a hard specular streak, a
// charcoal suit with sharp lapels, a Hollowell-orange tie and pin, an earpiece, skin lit flat and cool. Three
// faces: smug (one brow up, lids half down, a lopsided smile), irritated (brows knit, a tight mouth, a tic) and
// rattled (eyes wide, a sweat bead, a wobbling mouth, his tie knocked askew). Same 100x120 bust frame.

const INK = '#1E1A17'
const SKIN = '#C98F5E'
const SKIN_HI = '#E0AD80'
const SKIN_LO = '#A06E45'
const HAIR = '#1E1A17'
const SUIT = '#3B3F45'
const ORANGE = '#FF7A1A'

function Eyes({ face }: { face: RivalFace }) {
  if (face === 'rattled') {
    return (
      <g>
        {[41, 59].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy={49} rx={5.6} ry={5} fill="#FFFFFF" stroke={INK} strokeWidth={1.1} />
            <circle cx={cx} cy={49.2} r={1.5} fill={INK} />
          </g>
        ))}
      </g>
    )
  }
  // Smug: heavy upper lids half down. Irritated: narrowed to slits under the knit brows.
  const lid = face === 'smug' ? 1.4 : 2.4
  return (
    <g>
      {[41, 59].map((cx) => (
        <g key={cx}>
          <path d={`M${cx - 5.4} 49.6 Q${cx} ${45.2 + lid} ${cx + 5.4} 49.6 Q${cx} 52.6 ${cx - 5.4} 49.6Z`} fill="#FFFFFF" />
          <circle cx={cx + (face === 'smug' ? 1 : 0)} cy={49.8} r={2.4} fill="#3A2A20" />
          <circle cx={cx + (face === 'smug' ? 1 : 0)} cy={49.8} r={1.3} fill={INK} />
          <circle cx={cx - 0.4} cy={48.9} r={0.7} fill="#FFFFFF" />
          {/* the lid: a straight, heavy line */}
          <path d={`M${cx - 5.8} ${48.4 + lid * 0.4} Q${cx} ${45 + lid} ${cx + 5.8} ${48.4 + lid * 0.4}`} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}

function Brows({ face }: { face: RivalFace }) {
  if (face === 'smug') {
    // The left brow arched high, the right flat: one eyebrow raised.
    return (
      <g fill={HAIR}>
        <path d="M34 39 Q40 33 46.5 37.5 L46 39.4 Q40 35.6 34.4 40.8Z" />
        <path d="M53.5 41.4 Q60 40 66 41.6 L65.8 43.2 Q60 41.8 53.8 43.2Z" />
      </g>
    )
  }
  if (face === 'irritated') {
    // Knit: inner ends pulled down hard.
    return (
      <g fill={HAIR}>
        <path d="M34 39.6 Q40 39 47 43 L46.2 44.8 Q40 41.4 34.2 41.6Z" />
        <path d="M66 39.6 Q60 39 53 43 L53.8 44.8 Q60 41.4 65.8 41.6Z" />
      </g>
    )
  }
  // Rattled: both lifted, inner ends up.
  return (
    <g fill={HAIR}>
      <path d="M34 39 Q40 37 46 34.6 L46.4 36.4 Q40 39 34.4 40.8Z" />
      <path d="M66 39 Q60 37 54 34.6 L53.6 36.4 Q60 39 65.6 40.8Z" />
    </g>
  )
}

function Mouth({ face }: { face: RivalFace }) {
  if (face === 'smug') {
    // A lopsided, closed smile with a flash of veneer.
    return (
      <g>
        <path d="M42 61 Q50 65.5 59.5 59" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
        <path d="M47 62.6 Q52 63.6 57 61.2 L56.6 62.6 Q52 64.6 47.4 63.6Z" fill="#FFFFFF" />
        <path d="M59.5 59 l1.4 -1" stroke={INK} strokeWidth={1.2} strokeLinecap="round" />
      </g>
    )
  }
  if (face === 'irritated') {
    return <path d="M44 62.6 L56 62.2" stroke={INK} strokeWidth={1.9} strokeLinecap="round" />
  }
  // Rattled: a wobbling line, the corners pulled down.
  return <path d="M43 64 Q45.5 61.2 48 63 Q50.5 64.6 53 62.6 Q55.5 61 57.5 64" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
}

export default function RivalArt({ size = 80, face = 'smug', title }: { size?: number; face?: RivalFace; title?: string }) {
  // Unique gradient ids per instance (a hidden copy's gradient would blank the others).
  const uid = useId().replace(/:/g, '')
  const g = (n: string) => `ra-${uid}-${n}`
  const askew = face === 'rattled'
  return (
    <svg
      width={size}
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      role="img"
      aria-label={title ?? 'Julian Crisp, Hollowell'}
      className="rival-art"
      data-face={face}
    >
      <defs>
        <linearGradient id={g('skin')} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={SKIN_HI} />
          <stop offset="0.55" stopColor={SKIN} />
          <stop offset="1" stopColor={SKIN_LO} />
        </linearGradient>
        <linearGradient id={g('suit')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#555A62" />
          <stop offset="0.5" stopColor={SUIT} />
          <stop offset="1" stopColor="#24272C" />
        </linearGradient>
        <linearGradient id={g('tie')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFB070" />
          <stop offset="0.45" stopColor={ORANGE} />
          <stop offset="1" stopColor="#C4520A" />
        </linearGradient>
        <linearGradient id={g('hair')} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0" stopColor="#3A3330" />
          <stop offset="0.5" stopColor={HAIR} />
          <stop offset="1" stopColor="#0C0A09" />
        </linearGradient>
      </defs>
      {/* the suit: broad, padded shoulders and sharp peak lapels */}
      <path d="M8 120 Q9 96 26 88 L43 82 L57 82 L74 88 Q91 96 92 120Z" fill={`url(#${g('suit')})`} stroke={INK} strokeWidth={1.6} />
      <path d="M43 82 L50 104 L57 82 L54 81 L50 92 L46 81Z" fill="#F4F2EE" stroke={INK} strokeWidth={1} />
      <path d="M43 82 L36 90 L41 93 L37 98 L50 112 Z" fill="#2E3237" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <path d="M57 82 L64 90 L59 93 L63 98 L50 112 Z" fill="#2E3237" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      {/* the tie, knocked askew when he's rattled, with a lacquer streak */}
      <g transform={askew ? 'rotate(9 50 86)' : undefined}>
        <path d="M47.4 85 L52.6 85 L51.6 89 L54 106 L50 111 L46 106 L48.4 89Z" fill={`url(#${g('tie')})`} stroke={INK} strokeWidth={1} />
        <path d="M49.3 90 L50.2 90 L51.4 104 L50.6 104Z" fill="#FFFFFF" opacity={0.55} />
      </g>
      {/* the Hollowell lapel pin: an orange chevron with a hard glint */}
      <g transform="translate(66 96)">
        <circle r={3.2} fill={ORANGE} stroke={INK} strokeWidth={0.8} />
        <path d="M-1.8 0.8 L0 -1.2 L1.8 0.8" fill="none" stroke="#FFFFFF" strokeWidth={0.9} strokeLinecap="round" />
      </g>
      {/* neck */}
      <path d="M43.5 66 L43.5 84 Q50 87 56.5 84 L56.5 66Z" fill={SKIN} stroke={INK} strokeWidth={1.2} />
      <path d="M43.5 70 Q50 76 56.5 70 L56.5 74 Q50 79 43.5 74Z" fill={SKIN_LO} opacity={0.6} />
      {/* ears, the right one with a clear earpiece and its coil */}
      <ellipse cx={28.8} cy={51} rx={3.5} ry={5.2} fill={SKIN} stroke={INK} strokeWidth={1.2} />
      <ellipse cx={71.2} cy={51} rx={3.5} ry={5.2} fill={SKIN} stroke={INK} strokeWidth={1.2} />
      <path d="M72.4 52 Q75 58 72 66 Q69 74 70 82" fill="none" stroke="#DDE6EA" strokeWidth={1.1} opacity={0.9} />
      <circle cx={72} cy={51} r={1.6} fill="#DDE6EA" stroke={INK} strokeWidth={0.6} />
      {/* the face: a squarer, clean-shaven jaw */}
      <path d="M29.5 45 Q29.5 24 50 24 Q70.5 24 70.5 45 Q70.5 60 64 67 Q58 72.5 50 72.5 Q42 72.5 36 67 Q29.5 60 29.5 45Z" fill={`url(#${g('skin')})`} stroke={INK} strokeWidth={1.8} />
      {/* an over-lit, plastic sheen on the forehead and cheekbone */}
      <path d="M38 33 Q46 29 54 30.4 Q46 32 39.4 35.6Z" fill="#FFFFFF" opacity={0.35} />
      <ellipse cx={37.5} cy={56} rx={3.4} ry={1.4} fill="#FFFFFF" opacity={0.28} />
      <Brows face={face} />
      <Eyes face={face} />
      <path d="M50.5 51.5 Q52.8 56.6 50.8 57.6 Q49.6 58 48.6 57.4" fill="none" stroke={SKIN_LO} strokeWidth={1.1} strokeLinecap="round" />
      <Mouth face={face} />
      {face === 'irritated' && <path d="M65.6 34 l2.4 -1.6 M66.8 36.6 l2.8 -0.4 M64 32.4 l1 -2.4" stroke="#C4520A" strokeWidth={1.1} strokeLinecap="round" />}
      {face === 'rattled' && (
        <g>
          <path d="M66.4 38 q2 3.2 0 5.4 q-2 -2.2 0 -5.4Z" fill="#BFE3F2" stroke="#5A8FB8" strokeWidth={0.6} />
          <path d="M31 40 q1.4 2.2 0 3.8 q-1.4 -1.6 0 -3.8Z" fill="#BFE3F2" stroke="#5A8FB8" strokeWidth={0.5} />
        </g>
      )}
      {/* lacquered hair: a hard side part swept back, one strand loose when rattled */}
      <path d="M28.4 46 Q26 22 46 18.4 Q64 16 70.6 30 Q72.4 37 71.4 45 Q69 34 62 30 Q52 26.6 40 30.4 Q33 33 30.4 46Z" fill={`url(#${g('hair')})`} stroke={INK} strokeWidth={1.4} />
      <path d="M40 30.4 Q49 23 62 25.6" fill="none" stroke="#0C0A09" strokeWidth={1.2} />
      <path d="M36 25.6 Q48 18.6 62 21.4 Q52 21.4 38.4 27.6Z" fill="#FFFFFF" opacity={0.42} />
      {askew && <path d="M44 29.6 Q41 36 43.6 40" fill="none" stroke={HAIR} strokeWidth={1.4} strokeLinecap="round" />}
    </svg>
  )
}
