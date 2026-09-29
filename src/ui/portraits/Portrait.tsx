import CathArt from '../CathArt'
import type { CathExpression } from '../../../shared/cath/cath'
import { CHARACTERS, type CharacterPortrait, type HairStyle } from '../../content/characters'

// STYLE.md 9: flat geometric busts, 3-5 colours plus skin tone, a 2px ink outline (scaled to a
// 100x120 viewBox so it still reads at the smallest size, 32px). Cath alone is drawn by the
// shared `shared/cath/` module (CathArt below) instead of these shapes, per STYLE.md's exception.
const INK = 'var(--ink, #2B2320)'

function Eyebrow({ cx, angle }: { cx: number; angle: number }) {
  return (
    <rect
      x={cx - 6}
      y={39}
      width={12}
      height={2.6}
      rx={1.3}
      fill={INK}
      transform={`rotate(${cx < 50 ? -angle : angle} ${cx} ${40})`}
    />
  )
}

function Eye({ cx, big }: { cx: number; big?: boolean }) {
  const rx = big ? 5.2 : 4
  const ry = big ? 6 : 4.6
  return (
    <g>
      <ellipse cx={cx} cy={46} rx={rx} ry={ry} fill="#FFFFFF" stroke={INK} strokeWidth={1.2} />
      <circle cx={cx} cy={47} r={rx * 0.55} fill="#2B2320" />
      <circle cx={cx - rx * 0.2} cy={45} r={rx * 0.18} fill="#FFFFFF" />
      {big && <circle cx={cx + rx * 0.3} cy={48} r={rx * 0.12} fill="#FFFFFF" />}
    </g>
  )
}

function Mouth({ kind }: { kind: CharacterPortrait['mouth'] }) {
  const paths: Record<string, string> = {
    smile: 'M 44 60 Q 50 65 56 60',
    grin: 'M 42 59 Q 50 67 58 59 Q 50 62 42 59',
    neutral: 'M 45 61 L 55 61',
    smirk: 'M 44 60 Q 50 63 58 58',
  }
  return <path d={paths[kind]} fill={kind === 'grin' ? INK : 'none'} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
}

function Hair({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'braid':
      return (
        <g>
          <path d="M 26 40 Q 24 15 50 14 Q 76 15 74 40 L 68 38 Q 68 20 50 20 Q 32 20 32 38 Z" fill={color} stroke={INK} strokeWidth={1.5} />
          <rect x={45} y={38} width={10} height={34} rx={4} fill={color} stroke={INK} strokeWidth={1.2} />
        </g>
      )
    case 'curly':
      return (
        <g fill={color} stroke={INK} strokeWidth={1.3}>
          <circle cx={30} cy={26} r={8} />
          <circle cx={42} cy={18} r={9} />
          <circle cx={58} cy={18} r={9} />
          <circle cx={70} cy={26} r={8} />
          <circle cx={50} cy={16} r={8} />
        </g>
      )
    case 'short':
      return <path d="M 26 40 Q 24 16 50 15 Q 76 16 74 40 L 70 30 Q 50 18 30 30 Z" fill={color} stroke={INK} strokeWidth={1.5} />
    case 'bob':
      return <path d="M 25 44 Q 22 14 50 13 Q 78 14 75 44 L 72 46 Q 74 22 50 19 Q 26 22 28 46 Z" fill={color} stroke={INK} strokeWidth={1.5} />
    case 'slick':
      return <path d="M 27 34 Q 26 16 50 15 Q 74 16 73 34 Q 60 24 50 24 Q 40 24 27 34 Z" fill={color} stroke={INK} strokeWidth={1.5} />
    case 'curtain':
      return (
        <g>
          <path d="M 24 42 Q 20 12 50 10 Q 80 12 76 42 L 68 40 Q 70 18 50 16 Q 30 18 32 40 Z" fill={color} stroke={INK} strokeWidth={1.5} />
          <path d="M 30 30 Q 50 24 70 30 L 68 40 Q 50 33 32 40 Z" fill={color} />
          <path d="M 22 42 Q 18 60 24 78 L 30 76 Q 26 58 30 42 Z" fill={color} stroke={INK} strokeWidth={1.2} />
          <path d="M 78 42 Q 82 60 76 78 L 70 76 Q 74 58 70 42 Z" fill={color} stroke={INK} strokeWidth={1.2} />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d="M 25 38 Q 23 16 50 15 Q 77 16 75 38 L 25 38" fill={color} stroke={INK} strokeWidth={1.5} />
          <rect x={22} y={32} width={56} height={8} rx={4} fill={color} stroke={INK} strokeWidth={1.2} />
          <circle cx={50} cy={13} r={4} fill={color} stroke={INK} strokeWidth={1.2} />
        </g>
      )
    case 'flatcap':
      return (
        <g>
          <path d="M 24 36 Q 22 20 50 18 Q 78 20 76 36 Q 60 30 50 30 Q 40 30 24 36 Z" fill={color} stroke={INK} strokeWidth={1.5} />
          <ellipse cx={50} cy={20} rx={26} ry={7} fill={color} stroke={INK} strokeWidth={1.3} />
          <path d="M 28 20 Q 24 20 22 24 L 30 24 Z" fill={color} stroke={INK} strokeWidth={1} />
        </g>
      )
  }
}

function Accessory({ kind, accent }: { kind: NonNullable<CharacterPortrait['accessory']>; accent: string }) {
  switch (kind) {
    case 'waxedJacket':
      return <path d="M 30 95 L 34 78 L 50 84 L 66 78 L 70 95 Z" fill="none" stroke={accent} strokeWidth={2} />
    case 'apron':
      return (
        <g fill={accent} stroke={INK} strokeWidth={1.2}>
          <path d="M 38 75 L 62 75 L 66 118 L 34 118 Z" />
          <rect x={40} y={70} width={20} height={8} rx={2} />
        </g>
      )
    case 'cardigan':
      return <path d="M 28 96 L 40 80 L 50 88 L 60 80 L 72 96 L 72 118 L 28 118 Z" fill="none" stroke={accent} strokeWidth={2} strokeLinejoin="round" />
    case 'headphones':
      return (
        <g fill="none" stroke={INK} strokeWidth={2.4}>
          <path d="M 22 60 Q 22 78 30 86" />
          <path d="M 78 60 Q 78 78 70 86" />
          <circle cx={22} cy={62} r={5} fill={accent} stroke={INK} strokeWidth={1.4} />
          <circle cx={78} cy={62} r={5} fill={accent} stroke={INK} strokeWidth={1.4} />
        </g>
      )
    case 'suit':
      return (
        <g stroke={INK} strokeWidth={1.4}>
          <path d="M 34 78 L 50 88 L 66 78 L 76 118 L 24 118 Z" fill={accent} />
          <path d="M 46 82 L 50 118 L 54 82 L 50 90 Z" fill="#FFFFFF" />
        </g>
      )
    case 'tie':
      return <path d="M 47 84 L 53 84 L 56 96 L 50 116 L 44 96 Z" fill={accent} stroke={INK} strokeWidth={1} />
    case 'clipboard':
      return (
        <g>
          <rect x={68} y={88} width={16} height={22} rx={2} fill={accent} stroke={INK} strokeWidth={1.4} />
          <rect x={72} y={86} width={8} height={4} rx={1} fill={INK} />
        </g>
      )
    case 'scarf':
      return <path d="M 32 92 Q 50 100 68 92 L 66 106 Q 50 112 34 106 Z" fill={accent} stroke={INK} strokeWidth={1.4} />
  }
}

// The rest of the cast reuses Cath's five expression names: a brow tilt and a mouth swap per mood.
function expressionMood(e?: CathExpression): { brow: number; mouth?: CharacterPortrait['mouth'] } {
  switch (e) {
    case 'delighted':
      return { brow: -6, mouth: 'grin' }
    case 'wink':
      return { brow: -3, mouth: 'smirk' }
    case 'determined':
      return { brow: 10, mouth: 'neutral' }
    case 'worried':
      return { brow: -14, mouth: 'neutral' }
    default:
      return { brow: 0 }
  }
}

export default function Portrait({
  character,
  size = 96,
  expression,
}: {
  character: string
  size?: number
  expression?: CathExpression
}) {
  const spec = CHARACTERS[character]
  if (!spec) return null
  const mood = expressionMood(expression)
  // Cath is drawn by the shared art module (VISION.md "Cath: character bible"), same as in Runnel and on
  // the landing page. The bust framing has the same 5:6 shape as the other portraits.
  if (character === 'cath') {
    return <CathArt framing="bust" width={size} height={(size * 120) / 100} title={character} expression={expression} />
  }

  return (
    <svg width={size} height={(size * 120) / 100} viewBox="0 0 100 120" role="img" aria-label={character}>
      {/* torso */}
      <path d="M 20 120 Q 20 88 50 84 Q 80 88 80 120 Z" fill={spec.outfit} stroke={INK} strokeWidth={2} />
      {spec.accessory && <Accessory kind={spec.accessory} accent={spec.outfitAccent} />}
      {/* neck */}
      <rect x={44} y={68} width={12} height={16} fill={spec.skin} stroke={INK} strokeWidth={1.2} />
      {/* head */}
      <ellipse cx={50} cy={46} rx={22} ry={25} fill={spec.skin} stroke={INK} strokeWidth={2} />
      <Eyebrow cx={38} angle={spec.browAngle + mood.brow} />
      <Eyebrow cx={62} angle={spec.browAngle + mood.brow} />
      <Eye cx={38} />
      <Eye cx={62} />
      <ellipse cx={50} cy={53} rx={1.6} ry={1.2} fill={INK} opacity={0.5} />
      <Mouth kind={mood.mouth ?? spec.mouth} />
      <Hair style={spec.hairStyle} color={spec.hair} />
    </svg>
  )
}
