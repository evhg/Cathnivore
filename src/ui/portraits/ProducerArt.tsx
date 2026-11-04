import { useId } from 'react'
import type { CathExpression } from '../../../shared/cath/cath'
import { CHARACTERS } from '../../content/characters'
import { producerFace, type ProducerFace } from './producerFaces'

// Plan item 80: the four producers drawn to Cath's level (VISION 5, characters with presence): a shaded face with
// ears, almond eyes with an iris and two highlights, tapered brows, a nose, lips and blush; hair in a back and a
// front layer with a lit strand; a signature garment with its collar, and a prop. Three faces each: neutral,
// delighted and worried (Cath's other expression names fold into these). Same 100x120 bust frame as Portrait.


const INK = '#2B2320'

const mix = (a: string, b: string, k: number): string => {
  const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * k).toString(16).padStart(2, '0')).join('')
}
const shade = (c: string, k: number) => mix(c, '#1a1210', k)
const tint = (c: string, k: number) => mix(c, '#ffffff', k)


const IRIS: Record<string, string> = { mara: '#5B7A8C', tomas: '#5A3A22', ines: '#3E5A3A', sol: '#7A5530' }

function Eyes({ face, iris, lash }: { face: ProducerFace; iris: string; lash: string }) {
  if (face === 'delighted') {
    // Smiling eyes: closed upward arcs with a lash flick.
    return (
      <g fill="none" stroke={lash} strokeWidth={2.2} strokeLinecap="round">
        <path d="M35.5 50 Q41 44.5 46.5 50" />
        <path d="M53.5 50 Q59 44.5 64.5 50" />
        <path d="M35.5 50 l-1.6 -1" strokeWidth={1.4} />
        <path d="M64.5 50 l1.6 -1" strokeWidth={1.4} />
      </g>
    )
  }
  const open = face === 'worried' ? 1.12 : 1
  const pr = face === 'worried' ? 1.7 : 2.1
  return (
    <g>
      {[41, 59].map((cx, i) => {
        const dir = i === 0 ? -1 : 1
        return (
          <g key={cx}>
            <path
              d={`M${cx - 5.6} 49.5 Q${cx} ${49.5 - 5.2 * open} ${cx + 5.6} 49.5 Q${cx} ${49.5 + 3.6 * open} ${cx - 5.6} 49.5Z`}
              fill="#FFFDF8"
            />
            <circle cx={cx} cy={49.4} r={3.3} fill={iris} />
            <circle cx={cx} cy={49.4} r={pr} fill={INK} />
            <circle cx={cx - 1.2} cy={48.1} r={1.05} fill="#FFFFFF" />
            <circle cx={cx + 1.3} cy={50.6} r={0.5} fill="#FFFFFF" />
            {/* the upper lid and lashes, thicker at the outer corner */}
            <path
              d={`M${cx - 5.8} 49.6 Q${cx} ${49.5 - 5.6 * open} ${cx + 5.8} 49.6`}
              fill="none"
              stroke={lash}
              strokeWidth={1.8}
              strokeLinecap="round"
            />
            <path d={`M${cx + 5.6 * dir} 49.4 l${1.7 * dir} -1.3`} stroke={lash} strokeWidth={1.3} strokeLinecap="round" />
          </g>
        )
      })}
    </g>
  )
}

function Brows({ face, color }: { face: ProducerFace; color: string }) {
  // Worried: inner ends up; delighted: lifted and soft; neutral: level with a gentle arch.
  const inner = face === 'worried' ? 37.6 : face === 'delighted' ? 40 : 41.2
  const outer = face === 'worried' ? 41.6 : face === 'delighted' ? 40.4 : 41.6
  const lift = face === 'delighted' ? -1.6 : 0
  return (
    <g fill={color} stroke={shade(color, 0.3)} strokeWidth={0.5}>
      <path d={`M34.5 ${outer + lift} Q40 ${outer - 3.6 + lift} ${46} ${inner + lift} L${46} ${inner + 1.9 + lift} Q40 ${outer - 1.6 + lift} 34.5 ${outer + 1 + lift}Z`} />
      <path d={`M65.5 ${outer + lift} Q60 ${outer - 3.6 + lift} ${54} ${inner + lift} L${54} ${inner + 1.9 + lift} Q60 ${outer - 1.6 + lift} 65.5 ${outer + 1 + lift}Z`} />
    </g>
  )
}

function Mouth({ face, lip }: { face: ProducerFace; lip: string }) {
  if (face === 'delighted')
    return (
      <g>
        <path d="M42.5 61.5 Q50 71 57.5 61.5 Z" fill="#7A2E2A" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
        <path d="M44 62.2 Q50 64 56 62.2 L55.6 63.4 Q50 65 44.4 63.4Z" fill="#FFFDF8" />
        <path d="M46.5 67.2 Q50 65.4 53.5 67.2 Q50 69 46.5 67.2Z" fill="#D9736B" />
      </g>
    )
  if (face === 'worried')
    return <path d="M45 64.5 Q47.5 62.4 50 63.8 Q52.5 65.2 55 63.2" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
  return (
    <g>
      <path d="M45 62.6 Q50 65.6 55 62.6" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M46.6 64.6 Q50 66.4 53.4 64.6" fill="none" stroke={lip} strokeWidth={1.2} strokeLinecap="round" opacity={0.7} />
    </g>
  )
}

/** Hair behind the head (drawn before the face). */
function HairBack({ id, hair }: { id: string; hair: string }) {
  if (id === 'mara')
    return <path d="M27 50 Q24 22 50 20 Q76 22 73 50 L70 62 Q50 70 30 62Z" fill={shade(hair, 0.18)} />
  if (id === 'tomas')
    return (
      <g fill={shade(hair, 0.15)}>
        {[[28, 44], [72, 44], [27, 56], [73, 56]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={7} />)}
      </g>
    )
  return null
}

/** Hair in front (after the face), with a lit strand. */
function HairFront({ id, hair }: { id: string; hair: string }) {
  const lit = tint(hair, 0.35)
  switch (id) {
    case 'mara':
      // Silver hair swept back from a side parting into a braid over her right shoulder.
      return (
        <g>
          <path d="M27.5 46 Q25 20 49 19 Q75 19.5 72.5 46 Q69 33 60 30 Q50 27 43 31 Q33 35 27.5 46Z" fill={hair} stroke={shade(hair, 0.4)} strokeWidth={1.2} />
          <path d="M43 31 Q46 24.5 56 23" fill="none" stroke={shade(hair, 0.35)} strokeWidth={1} />
          <path d="M33 33 Q40 25 50 23.5 M58 26 Q66 28.5 69 36" fill="none" stroke={lit} strokeWidth={1.6} strokeLinecap="round" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <ellipse cx={70 + i * 1.5} cy={56 + i * 8} rx={5.6 - i * 0.35} ry={5.4} fill={hair} stroke={shade(hair, 0.4)} strokeWidth={1} />
              <path d={`M${67.5 + i * 1.5} ${54.5 + i * 8} q2.5 -1.6 5 0`} fill="none" stroke={lit} strokeWidth={1.1} strokeLinecap="round" />
            </g>
          ))}
          <rect x={75} y={101} width={6.4} height={3.4} rx={1.2} fill="#9C3B32" stroke={INK} strokeWidth={0.7} />
        </g>
      )
    case 'tomas':
      // Tight dark curls, each catching a little light.
      return (
        <g>
          {[[31, 31, 8], [40, 23, 8.5], [50, 20, 8.5], [60, 23, 8.5], [69, 31, 8], [36, 31, 6], [64, 31, 6], [50, 28, 6]].map(([x, y, r]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={r} fill={hair} stroke={shade(hair, 0.45)} strokeWidth={1} />
              <path d={`M${x! - r! * 0.45} ${y! - r! * 0.2} q${r! * 0.35} ${-r! * 0.45} ${r! * 0.8} ${-r! * 0.1}`} fill="none" stroke={lit} strokeWidth={1.1} strokeLinecap="round" />
            </g>
          ))}
        </g>
      )
    case 'ines':
      // A neat crop with a side-swept fringe.
      return (
        <g>
          <path d="M27 47 Q25 21 50 20 Q75 21 73 47 Q72 36 66 31 Q56 37 38 34 Q31 38 27 47Z" fill={hair} stroke={shade(hair, 0.5)} strokeWidth={1.2} />
          <path d="M38 34 Q50 26 66 31" fill="none" stroke={shade(hair, 0.5)} strokeWidth={0.9} />
          <path d="M34 30 Q44 23 56 23.5" fill="none" stroke={lit} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
    case 'sol':
      // A ribbed beanie with its fold, curls peeking out, headphones over it.
      return (
        <g>
          <circle cx={28.5} cy={48} r={4} fill={hair} />
          <circle cx={71.5} cy={48} r={4} fill={hair} />
          <path d="M27 38 Q26 15 50 14 Q74 15 73 38Z" fill={hair} stroke={shade(hair, 0.45)} strokeWidth={1.2} />
          <path d="M36 18 v19 M43 15.5 v21.5 M50 14.5 v22.5 M57 15.5 v21.5 M64 18 v19" stroke={shade(hair, 0.25)} strokeWidth={1} />
          <rect x={24.5} y={33} width={51} height={9} rx={4.5} fill={tint(hair, 0.12)} stroke={shade(hair, 0.45)} strokeWidth={1.1} />
          <path d="M33 21 Q41 16 50 16" fill="none" stroke={lit} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
  }
  return null
}

function Garment({ id, uid, outfit, accent }: { id: string; uid: string; outfit: string; accent: string }) {
  const dark = shade(outfit, 0.3)
  const lit = tint(outfit, 0.18)
  const body = (
    <path d="M17 120 Q17 90 50 84.5 Q83 90 83 120Z" fill={`url(#pa-${uid}-cloth)`} stroke={INK} strokeWidth={1.8} />
  )
  switch (id) {
    case 'mara':
      // A waxed field jacket with a corduroy collar, and a brief tied in red tape under her arm.
      return (
        <g>
          {body}
          <path d="M36 86 L50 99 L64 86 L61 82 L50 92 L39 82Z" fill={shade(accent, 0.1)} stroke={INK} strokeWidth={1.2} />
          <path d="M39 85 l3 3 M42 83.5 l3 3 M58 83.5 l-3 3 M61 85 l-3 3" stroke={tint(accent, 0.2)} strokeWidth={0.8} />
          <path d="M50 99 V120" stroke={dark} strokeWidth={1.4} />
          <circle cx={52.5} cy={106} r={1.2} fill={tint(outfit, 0.4)} />
          <circle cx={52.5} cy={114} r={1.2} fill={tint(outfit, 0.4)} />
          <path d="M26 104 Q30 98 35 99" fill="none" stroke={lit} strokeWidth={1.4} strokeLinecap="round" />
          <g transform="rotate(-14 30 110)">
            <rect x={18} y={104} width={24} height={13} rx={1.5} fill="#F2E8D2" stroke={INK} strokeWidth={1.1} />
            <path d="M22 108h14M22 111h11" stroke="#B9A98A" strokeWidth={0.9} />
            <path d="M28 104v13" stroke="#B5352B" strokeWidth={1.8} />
          </g>
        </g>
      )
    case 'tomas':
      // A mustard shirt under a striped market apron, carrots in its pocket and a pencil behind his ear.
      return (
        <g>
          {body}
          <path d="M37 86 L50 95 L63 86 L60 83 L50 90 L40 83Z" fill={tint(outfit, 0.25)} stroke={INK} strokeWidth={1.1} />
          <path d="M37 92 L63 92 L67 120 L33 120Z" fill={accent} stroke={INK} strokeWidth={1.2} />
          <path d="M42 92 L39.5 120 M50 92 V120 M58 92 L60.5 120" stroke={shade(accent, 0.12)} strokeWidth={1.4} />
          <path d="M40 92 L36 84 M60 92 L64 84" stroke={shade(accent, 0.2)} strokeWidth={1.6} />
          <rect x={53} y={103} width={11} height={9} rx={1.5} fill={shade(accent, 0.06)} stroke={INK} strokeWidth={1} />
          <path d="M56 103 l-1.5 -5 M58.5 103 l0 -6 M61 103 l1.5 -5" stroke="#5E8B3A" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M55.5 103.5 l1.5 6 M58.5 103.5 l0 6.5 M61.5 103.5 l-1.5 6" stroke="#E07B2C" strokeWidth={2.2} strokeLinecap="round" />
          <g transform="rotate(-62 74 40)">
            <rect x={64} y={38.6} width={18} height={2.8} rx={0.6} fill="#E8B83A" stroke={INK} strokeWidth={0.6} />
            <path d="M82 38.6 l3 1.4 -3 1.4z" fill="#F2D9B8" stroke={INK} strokeWidth={0.5} />
          </g>
        </g>
      )
    case 'ines':
      // A blue cardigan over a white collar, a stethoscope round her neck, a pen in the pocket.
      return (
        <g>
          {body}
          <path d="M40 85 L50 92 L60 85 L50 120Z" fill={accent} stroke={INK} strokeWidth={1.1} />
          <path d="M40 85 L46 92 L50 92 M60 85 L54 92 L50 92" fill="none" stroke={INK} strokeWidth={1} />
          <path d="M40 85 L49 120 M60 85 L51 120" stroke={dark} strokeWidth={1.6} />
          <rect x={60.5} y={100} width={9} height={7} rx={1} fill="none" stroke={dark} strokeWidth={1} />
          <path d="M63 100 v-4" stroke="#C0392B" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M38 86 Q34 100 41 106 Q46 108 47 101" fill="none" stroke="#3B3F45" strokeWidth={1.8} strokeLinecap="round" />
          <path d="M62 86 Q66 96 60 103" fill="none" stroke="#3B3F45" strokeWidth={1.8} strokeLinecap="round" />
          <circle cx={59.5} cy={105} r={3.4} fill="#C9CDD1" stroke={INK} strokeWidth={1} />
          <circle cx={58.6} cy={104} r={1} fill="#FFFFFF" />
        </g>
      )
    case 'sol':
      // A plum hoodie with its drawstrings, and a little podcast mic badge.
      return (
        <g>
          {body}
          <path d="M33 88 Q50 98 67 88 Q63 84 50 86 Q37 84 33 88Z" fill={dark} stroke={INK} strokeWidth={1.1} />
          <path d="M45 92 V106 M55 92 V106" stroke={accent} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={45} cy={107} r={1.4} fill={tint(accent, 0.3)} />
          <circle cx={55} cy={107} r={1.4} fill={tint(accent, 0.3)} />
          <g transform="translate(66 104)">
            <circle r={6} fill="#2F2A33" stroke={INK} strokeWidth={1} />
            <rect x={-2} y={-3.6} width={4} height={5.5} rx={2} fill="#D9D3DC" />
            <path d="M-3 0 Q0 4 3 0 M0 2 v2" fill="none" stroke="#D9D3DC" strokeWidth={0.8} />
          </g>
        </g>
      )
  }
  return body
}

/** Things worn over the face: Ines's glasses, Sol's headphones. */
function FaceExtras({ id, accent }: { id: string; accent: string }) {
  if (id === 'ines')
    return (
      <g fill="none" stroke="#3B3F45" strokeWidth={1.3}>
        <rect x={34} y={44.5} width={14} height={10} rx={4} fill="#FFFFFF" fillOpacity={0.12} />
        <rect x={52} y={44.5} width={14} height={10} rx={4} fill="#FFFFFF" fillOpacity={0.12} />
        <path d="M48 48.5 Q50 47 52 48.5 M34 48 L28.5 46.5 M66 48 L71.5 46.5" />
      </g>
    )
  if (id === 'sol')
    return (
      <g>
        <path d="M25 47 Q25 9 50 9 Q75 9 75 47" fill="none" stroke="#2F2A33" strokeWidth={3} strokeLinecap="round" />
        <rect x={20} y={42} width={9} height={15} rx={4} fill={accent} stroke={INK} strokeWidth={1.2} />
        <rect x={71} y={42} width={9} height={15} rx={4} fill={accent} stroke={INK} strokeWidth={1.2} />
        <rect x={21.8} y={44.5} width={2.2} height={9} rx={1.1} fill={tint(accent, 0.45)} />
      </g>
    )
  return null
}

export default function ProducerArt({ character, size = 96, expression }: { character: string; size?: number; expression?: CathExpression }) {
  // Unique gradient ids per instance: a gradient defined inside a hidden copy would blank every other copy.
  const uid = useId().replace(/:/g, '')
  const spec = CHARACTERS[character]
  if (!spec) return null
  const face = producerFace(expression)
  const skin = spec.skin
  const skinShade = shade(skin, 0.16)
  const lash = shade(spec.hair, 0.55)
  const id = character
  return (
    <svg
      width={size}
      height={(size * 120) / 100}
      viewBox="0 0 100 120"
      role="img"
      aria-label={character}
      className="producer-art"
      data-face={face}
    >
      <defs>
        <radialGradient id={`pa-${uid}-skin`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor={tint(skin, 0.12)} />
          <stop offset="0.7" stopColor={skin} />
          <stop offset="1" stopColor={skinShade} />
        </radialGradient>
        <linearGradient id={`pa-${uid}-cloth`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tint(spec.outfit, 0.12)} />
          <stop offset="1" stopColor={shade(spec.outfit, 0.22)} />
        </linearGradient>
      </defs>
      <HairBack id={id} hair={spec.hair} />
      <Garment id={id} uid={uid} outfit={spec.outfit} accent={spec.outfitAccent} />
      {/* neck with the jaw's shadow */}
      <path d="M43.5 66 L43.5 85 Q50 89 56.5 85 L56.5 66Z" fill={skin} stroke={INK} strokeWidth={1.2} />
      <path d="M43.5 70 Q50 76 56.5 70 L56.5 74 Q50 79 43.5 74Z" fill={skinShade} opacity={0.7} />
      {/* ears */}
      <ellipse cx={28.6} cy={51} rx={3.6} ry={5.4} fill={skin} stroke={INK} strokeWidth={1.2} />
      <ellipse cx={71.4} cy={51} rx={3.6} ry={5.4} fill={skin} stroke={INK} strokeWidth={1.2} />
      {/* face: a soft jaw rather than an egg */}
      <path
        d="M29 46 Q29 24 50 24 Q71 24 71 46 Q71 60 63 68 Q57 73.5 50 73.5 Q43 73.5 37 68 Q29 60 29 46Z"
        fill={`url(#pa-${uid}-skin)`}
        stroke={INK}
        strokeWidth={1.8}
      />
      <ellipse cx={39} cy={58} rx={4.6} ry={2.6} fill="#E8837C" opacity={face === 'delighted' ? 0.55 : 0.32} />
      <ellipse cx={61} cy={58} rx={4.6} ry={2.6} fill="#E8837C" opacity={face === 'delighted' ? 0.55 : 0.32} />
      <Brows face={face} color={id === 'sol' ? shade(spec.hair, 0.2) : shade(spec.hair, 0.12)} />
      <Eyes face={face} iris={IRIS[id] ?? '#5A3A22'} lash={lash} />
      <path d="M50.5 51.5 Q52.6 56.5 50.8 57.6 Q49.6 58 48.6 57.4" fill="none" stroke={shade(skin, 0.4)} strokeWidth={1.1} strokeLinecap="round" />
      {face === 'worried' && <path d="M66 41 q1.6 2.6 0 4.4 q-1.6 -1.8 0 -4.4Z" fill="#BFE3F2" stroke="#5A8FB8" strokeWidth={0.6} />}
      <Mouth face={face} lip={shade(skin, 0.35)} />
      <HairFront id={id} hair={spec.hair} />
      <FaceExtras id={id} accent={spec.outfitAccent} />
    </svg>
  )
}
