import type { CathExpression } from '../../../shared/cath/cath'
import { CHARACTERS, type CharacterPortrait, type HairStyle } from '../../content/characters'

// Plan item 5 (ROADMAP 58, U7): the story cast as half-length figures for the graphic-novel Scene, drawn in
// the same storybook cel style as Cath (shared/cath/cath.ts): key light from the viewer's right, a shadow
// side on the viewer's left, a warm rim light on the right-hand edges, and outlines in darker tones of each
// material rather than one flat ink. The viewBox matches Cath's `half` framing (40 20 320 480) so the
// whole cast stands at one scale beside her. Expressions reuse Cath's five names, and the Scene's CSS tilts
// `.fig-head` and leans `.fig-body` per mood, so every line gets its own pose. No inline styles (CSP).

type Rgb = [number, number, number]
const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
const toHex = (c: Rgb) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
/** Mix a colour toward black (amount < 0) or a warm white (amount > 0). */
function tone(h: string, amount: number): string {
  const c = hex(h)
  const target: Rgb = amount < 0 ? [24, 14, 12] : [255, 244, 228]
  const a = Math.abs(amount)
  return toHex(c.map((v, i) => v + (target[i]! - v) * a) as Rgb)
}

/** Per-character traits the bust spec doesn't carry: eye colour, build, age lines, stubble. */
const EXTRA: Record<string, { iris: string; build: number; lines?: boolean; stubble?: boolean; freckles?: boolean }> = {
  mara: { iris: '#5B6B4A', build: 1.04, lines: true },
  tomas: { iris: '#3B2418', build: 1.1, stubble: true },
  ines: { iris: '#4A3A2A', build: 0.94, freckles: true },
  sol: { iris: '#3A2C24', build: 1.0, stubble: true },
  pell: { iris: '#6A8CA0', build: 1.06, lines: true },
  vane: { iris: '#3FA7BC', build: 0.92 },
  crisp: { iris: '#2A1E16', build: 1.0 },
  pip: { iris: '#5A7A8C', build: 0.98, freckles: true },
}

interface Mood {
  brow: number
  inner: number
  mouth: CharacterPortrait['mouth'] | 'open' | 'tight'
  eyes: 'open' | 'happy' | 'wink' | 'narrow'
}

function moodFor(e: CathExpression | undefined, base: CharacterPortrait): Mood {
  switch (e) {
    case 'delighted':
      return { brow: -4, inner: -3, mouth: 'open', eyes: 'happy' }
    case 'wink':
      return { brow: -2, inner: 0, mouth: 'smirk', eyes: 'wink' }
    case 'determined':
      return { brow: 8, inner: 5, mouth: 'tight', eyes: 'narrow' }
    case 'worried':
      return { brow: -10, inner: -8, mouth: 'neutral', eyes: 'open' }
    default:
      return { brow: base.browAngle, inner: 0, mouth: base.mouth, eyes: 'open' }
  }
}

function HairBack({ style, c }: { style: HairStyle; c: string }) {
  const line = tone(c, -0.55)
  switch (style) {
    case 'braid':
      return (
        <g>
          <path d="M 136 160 Q 128 80 200 72 Q 272 80 264 160 L 258 214 Q 200 236 142 214 Z" fill={tone(c, -0.25)} stroke={line} strokeWidth={2} />
          {/* the braid over her shoulder, plait by plait */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={248 + i * 3} cy={232 + i * 30} rx={17 - i * 1.2} ry={19} fill={i % 2 ? tone(c, -0.1) : c} stroke={line} strokeWidth={1.8} />
          ))}
          <rect x={256} y={404} width={14} height={8} rx={3} fill="#7A4E2E" />
          <path d="M 257 412 Q 263 440 270 412" fill={c} stroke={line} strokeWidth={1.5} />
        </g>
      )
    case 'bob':
      return <path d="M 128 168 Q 120 74 200 68 Q 280 74 272 168 Q 276 226 252 244 L 148 244 Q 124 226 128 168 Z" fill={tone(c, -0.25)} stroke={line} strokeWidth={2} />
    case 'curtain':
      return <path d="M 128 170 Q 118 70 200 64 Q 282 70 272 170 L 286 330 Q 200 350 114 330 Z" fill={tone(c, -0.3)} stroke={line} strokeWidth={2} />
    default:
      return null
  }
}

function HairFront({ style, c }: { style: HairStyle; c: string }) {
  const line = tone(c, -0.55)
  const shine = tone(c, 0.35)
  switch (style) {
    case 'braid':
      return (
        <g>
          <path d="M 138 156 Q 134 84 200 80 Q 266 84 262 156 Q 250 118 226 108 Q 200 100 172 110 Q 146 122 138 156 Z" fill={c} stroke={line} strokeWidth={2} />
          <path d="M 200 82 L 200 104" stroke={line} strokeWidth={1.6} />
          <path d="M 160 98 Q 180 88 196 90 M 210 90 Q 236 90 248 106" stroke={shine} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
        </g>
      )
    case 'curly':
      return (
        <g stroke={line} strokeWidth={2}>
          {[
            [146, 132, 20], [160, 102, 22], [186, 84, 22], [214, 84, 22], [240, 102, 22], [254, 132, 20], [200, 74, 18], [138, 158, 14], [262, 158, 14],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? tone(c, 0.08) : c} />
          ))}
          {[[168, 96], [204, 76], [236, 96], [252, 124]].map(([x, y], i) => (
            <path key={i} d={`M ${x! - 7} ${y} q 7 -8 14 0`} stroke={shine} strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.75} />
          ))}
        </g>
      )
    case 'short':
      return (
        <g>
          <path d="M 138 150 Q 132 82 200 78 Q 268 82 262 150 L 254 128 Q 236 104 200 106 Q 170 106 150 120 L 140 152 Z" fill={c} stroke={line} strokeWidth={2} />
          <path d="M 150 120 Q 176 96 212 100 Q 186 110 172 126 Z" fill={tone(c, -0.2)} />
          <path d="M 176 92 Q 204 84 236 96" stroke={shine} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
        </g>
      )
    case 'bob':
      return (
        <g>
          <path d="M 134 174 Q 128 82 200 76 Q 272 82 266 174 L 254 176 Q 256 120 226 110 Q 196 128 150 130 Q 146 150 146 176 Z" fill={c} stroke={line} strokeWidth={2} />
          <path d="M 166 92 Q 200 80 240 96" stroke={shine} strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.7} />
          <path d="M 140 172 L 146 240 M 260 172 L 254 240" stroke={line} strokeWidth={1.6} opacity={0.6} />
        </g>
      )
    case 'slick':
      return (
        <g>
          <path d="M 140 144 Q 136 82 200 78 Q 264 82 260 144 Q 252 112 230 104 Q 196 96 166 108 Q 146 118 140 144 Z" fill={c} stroke={line} strokeWidth={2} />
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M ${158 + i * 18} ${112 - i * 3} Q ${190 + i * 14} ${86} ${240} ${100 + i * 4}`} stroke={i === 1 ? shine : line} strokeWidth={i === 1 ? 2.6 : 1.2} fill="none" opacity={0.6} />
          ))}
        </g>
      )
    case 'curtain':
      return (
        <g>
          <path d="M 132 172 Q 126 74 200 70 Q 274 74 268 172 L 254 170 Q 252 112 204 104 Q 150 110 146 172 Z" fill={c} stroke={line} strokeWidth={2} />
          <path d="M 204 104 Q 190 130 152 150 L 150 128 Q 176 108 204 104 Z" fill={tone(c, -0.2)} />
        </g>
      )
    case 'beanie':
      return (
        <g>
          <path d="M 138 140 Q 136 66 200 62 Q 264 66 262 140 Z" fill={c} stroke={line} strokeWidth={2} />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M ${152 + i * 16} 134 Q ${154 + i * 15} 100 ${170 + i * 10} 72`} stroke={tone(c, -0.25)} strokeWidth={2} fill="none" />
          ))}
          <rect x={132} y={124} width={136} height={24} rx={10} fill={tone(c, 0.1)} stroke={line} strokeWidth={2} />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={i} d={`M ${144 + i * 16} 128 v 16`} stroke={tone(c, -0.2)} strokeWidth={2} />
          ))}
          <circle cx={200} cy={58} r={12} fill={tone(c, 0.15)} stroke={line} strokeWidth={2} />
          <path d="M 228 72 Q 248 84 254 112" stroke={tone(c, 0.35)} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
        </g>
      )
    case 'flatcap':
      return (
        <g>
          <path d="M 138 146 Q 136 100 200 96 Q 264 100 262 146 L 250 130 Q 200 116 150 130 Z" fill="#6B4A2B" stroke="#3A2614" strokeWidth={2} />
          <path d="M 132 118 Q 140 76 204 74 Q 270 78 274 112 Q 260 126 200 124 Q 150 124 132 118 Z" fill={tone('#8C6A4A', -0.05)} stroke="#4A3220" strokeWidth={2} />
          <path d="M 132 118 Q 112 122 104 134 Q 150 140 200 128" fill={tone('#8C6A4A', -0.3)} stroke="#4A3220" strokeWidth={2} />
          {/* herringbone hint */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path key={i} d={`M ${150 + i * 18} 86 l 6 10 l 6 -10`} stroke="#6E5236" strokeWidth={1.2} fill="none" opacity={0.7} />
          ))}
          <path d="M 220 82 Q 252 86 266 104" stroke="#C4A57E" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.6} />
        </g>
      )
  }
}

function Eye({ cx, side, iris, kind, line }: { cx: number; side: -1 | 1; iris: string; kind: Mood['eyes']; line: string }) {
  const closed = kind === 'happy' || (kind === 'wink' && side === 1)
  if (closed) {
    return <path d={`M ${cx - 14} 168 Q ${cx} 156 ${cx + 14} 168`} stroke={line} strokeWidth={3.4} fill="none" strokeLinecap="round" />
  }
  const top = kind === 'narrow' ? 162 : 157
  return (
    <g>
      <path d={`M ${cx - 15} 168 Q ${cx} ${top - 2} ${cx + 15} 167 Q ${cx} 178 ${cx - 15} 168 Z`} fill="#FFFDFB" />
      <circle cx={cx + side * 1} cy={168} r={8} fill={iris} />
      <circle cx={cx + side * 1} cy={168} r={4.2} fill="#1A110E" />
      <circle cx={cx + side * 1 + 3} cy={165} r={2.4} fill="#FFFFFF" />
      <circle cx={cx + side * 1 - 3} cy={171} r={1.1} fill="#FFFFFF" opacity={0.8} />
      {/* lid line: thick and tapered at the outer corner */}
      <path d={`M ${cx - 16} 168 Q ${cx} ${top - 4} ${cx + 16} 166`} stroke="#221613" strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d={`M ${cx - 12} 174 Q ${cx} 179 ${cx + 12} 173`} stroke={line} strokeWidth={1.2} fill="none" opacity={0.5} />
    </g>
  )
}

function Mouth({ kind, lip, line }: { kind: Mood['mouth']; lip: string; line: string }) {
  switch (kind) {
    case 'open':
    case 'grin':
      return (
        <g>
          <path d="M 182 206 Q 200 226 218 206 Q 200 211 182 206 Z" fill="#7A2E2E" stroke={line} strokeWidth={2} strokeLinejoin="round" />
          <path d="M 186 207.5 Q 200 212 214 207.5 L 213 211 Q 200 214 187 211 Z" fill="#FFFDF8" />
        </g>
      )
    case 'smile':
      return <path d="M 184 207 Q 200 220 216 207" stroke={line} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    case 'smirk':
      return <path d="M 186 210 Q 202 216 218 204" stroke={line} strokeWidth={2.6} fill="none" strokeLinecap="round" />
    case 'tight':
      return <path d="M 188 211 Q 200 208 212 211" stroke={line} strokeWidth={3} fill="none" strokeLinecap="round" />
    default:
      return (
        <g>
          <path d="M 188 210 Q 200 213 212 210" stroke={line} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <path d="M 192 215 Q 200 218 208 215" stroke={lip} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.6} />
        </g>
      )
  }
}

/** The outfit layer over the torso: lapels, aprons, collars, held props. */
function Outfit({ kind, base, accent }: { kind: CharacterPortrait['accessory']; base: string; accent: string }) {
  const line = tone(base, -0.55)
  switch (kind) {
    case 'waxedJacket':
      return (
        <g>
          {/* corduroy collar, flap pockets and a brass snap placket */}
          <path d="M 160 284 L 200 330 L 240 284 L 262 300 L 214 352 L 200 340 L 186 352 L 138 300 Z" fill="#7A4E2E" stroke="#3E2614" strokeWidth={2} strokeLinejoin="round" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M ${146 + i * 6} ${298 + i * 7} l 12 -8 M ${254 - i * 6} ${298 + i * 7} l -12 -8`} stroke="#5E3A20" strokeWidth={1.2} />
          ))}
          <path d="M 200 340 L 200 500" stroke={line} strokeWidth={2.4} />
          {[370, 410, 450].map((y) => (
            <circle key={y} cx={200} cy={y} r={3.4} fill="#D4AE58" stroke="#8A6A2A" strokeWidth={1} />
          ))}
          <path d="M 128 420 h 50 v 14 h -50 Z M 222 420 h 50 v 14 h -50 Z" fill={tone(base, -0.12)} stroke={line} strokeWidth={1.8} />
          <path d="M 120 300 Q 170 296 200 340 Q 230 296 280 300" stroke={tone(base, 0.4)} strokeWidth={1.4} fill="none" opacity={0.4} />
        </g>
      )
    case 'apron':
      return (
        <g>
          <path d="M 168 290 Q 200 300 232 290" stroke={tone(base, 0.25)} strokeWidth={10} fill="none" />
          <path d="M 162 330 L 238 330 L 252 500 L 148 500 Z" fill={accent} stroke={tone(accent, -0.5)} strokeWidth={2} strokeLinejoin="round" />
          <path d="M 162 330 Q 156 300 176 286 M 238 330 Q 244 300 224 286" stroke={tone(accent, -0.25)} strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d="M 176 410 h 48 v 34 h -48 Z" fill={tone(accent, -0.08)} stroke={tone(accent, -0.45)} strokeWidth={1.6} />
          <path d="M 190 404 l 4 -26 M 204 404 l -2 -30" stroke="#8A6A2A" strokeWidth={3} strokeLinecap="round" />
          <circle cx={194} cy={376} r={4} fill="#5B7F3A" />
          <circle cx={202} cy={372} r={5} fill="#86AC5B" />
          <path d="M 150 372 L 250 372" stroke={tone(accent, -0.3)} strokeWidth={6} opacity={0.5} />
          <path d="M 162 340 L 168 500" stroke={tone(accent, -0.2)} strokeWidth={1.2} opacity={0.5} />
        </g>
      )
    case 'cardigan':
      return (
        <g>
          <path d="M 176 286 L 200 312 L 224 286 L 226 500 L 174 500 Z" fill={accent} stroke={tone(accent, -0.45)} strokeWidth={1.8} />
          <path d="M 186 292 Q 200 302 214 292" stroke={tone(accent, -0.3)} strokeWidth={1.4} fill="none" />
          <path d="M 174 288 L 186 500 M 226 288 L 214 500" stroke={tone(base, -0.45)} strokeWidth={2.4} />
          {[350, 390, 430, 470].map((y) => (
            <circle key={y} cx={212} cy={y} r={3.6} fill={tone(base, 0.45)} stroke={line} strokeWidth={1} />
          ))}
          {/* cable knit */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path key={i} d={`M 140 ${330 + i * 22} q 6 -8 12 0 q 6 8 12 0 M 248 ${330 + i * 22} q 6 -8 12 0 q 6 8 12 0`} stroke={tone(base, -0.25)} strokeWidth={1.6} fill="none" />
          ))}
        </g>
      )
    case 'headphones':
      return (
        <g>
          <path d="M 176 286 Q 200 312 224 286 L 222 300 Q 200 322 178 300 Z" fill={tone(base, -0.3)} />
          {/* headphones resting round the neck */}
          <path d="M 154 288 Q 200 330 246 288" stroke="#2A2422" strokeWidth={8} fill="none" strokeLinecap="round" />
          <rect x={136} y={270} width={28} height={38} rx={12} fill={accent} stroke="#2A2422" strokeWidth={3} />
          <rect x={236} y={270} width={28} height={38} rx={12} fill={accent} stroke="#2A2422" strokeWidth={3} />
          <path d="M 200 330 Q 196 380 206 430" stroke="#2A2422" strokeWidth={2} fill="none" />
          <path d="M 150 360 h 40 M 210 360 h 40" stroke={tone(base, 0.3)} strokeWidth={1.4} opacity={0.4} />
          <path d="M 160 440 Q 200 452 240 440 L 236 470 Q 200 480 164 470 Z" fill={tone(base, -0.15)} stroke={line} strokeWidth={1.6} />
        </g>
      )
    case 'suit':
    case 'tie':
      return (
        <g>
          <path d="M 176 286 L 200 312 L 224 286 L 216 500 L 184 500 Z" fill="#FFFFFF" stroke="#B8B0A8" strokeWidth={1.4} />
          <path d="M 194 304 L 206 304 L 212 330 L 200 420 L 188 330 Z" fill={kind === 'tie' ? accent : '#7A2030'} stroke={tone(kind === 'tie' ? accent : '#7A2030', -0.5)} strokeWidth={1.4} />
          <path d="M 170 286 L 200 360 L 186 500 L 140 500 L 130 330 Z M 230 286 L 200 360 L 214 500 L 260 500 L 270 330 Z" fill={tone(base, -0.06)} stroke={line} strokeWidth={2} strokeLinejoin="round" />
          <path d="M 170 286 L 152 336 L 176 330 Z M 230 286 L 248 336 L 224 330 Z" fill={tone(base, 0.12)} stroke={line} strokeWidth={1.6} />
          <path d="M 232 330 h 22 l -2 6 h -20 Z" fill="#FFFFFF" opacity={0.85} />
          {[420, 456].map((y) => (
            <circle key={y} cx={208} cy={y} r={3.4} fill={tone(base, -0.4)} />
          ))}
        </g>
      )
    case 'clipboard':
      return (
        <g>
          <path d="M 176 286 L 200 314 L 224 286 L 222 300 L 200 326 L 178 300 Z" fill={tone(base, 0.45)} stroke={line} strokeWidth={1.4} />
          <path d="M 200 326 L 200 500" stroke={line} strokeWidth={2} />
          {/* market inspector's badge on a lanyard */}
          <path d="M 176 296 L 166 372 M 224 296 L 234 372" stroke={accent} strokeWidth={4} />
          <rect x={156} y={366} width={30} height={22} rx={3} fill="#F7F0E3" stroke={line} strokeWidth={1.6} />
          <rect x={160} y={370} width={9} height={11} fill="#6E7C4B" />
          <path d="M 172 373 h 10 M 172 379 h 8" stroke={line} strokeWidth={1.4} />
        </g>
      )
    case 'scarf':
      return (
        <g>
          <path d="M 168 280 Q 200 310 232 280 Q 248 300 236 318 Q 200 336 164 318 Q 152 300 168 280 Z" fill={accent} stroke={tone(accent, -0.5)} strokeWidth={2} />
          <path d="M 220 316 L 236 420 L 218 424 L 206 322 Z" fill={tone(accent, -0.12)} stroke={tone(accent, -0.5)} strokeWidth={1.8} />
          <path d="M 176 296 Q 200 316 226 296" stroke={tone(accent, 0.4)} strokeWidth={2} fill="none" opacity={0.6} />
        </g>
      )
    default:
      return null
  }
}

/** What each speaker holds, so they read at a glance: Mara's crook, Sol's mic, Tomas's carrots, Ines's notebook. */
function Prop({ who, skin, skinLine }: { who: string; skin: string; skinLine: string }) {
  const hand = (cx: number, cy: number, flip = 1) => (
    <g>
      <ellipse cx={cx} cy={cy} rx={15} ry={13} fill={skin} stroke={skinLine} strokeWidth={1.8} />
      <path d={`M ${cx - 9 * flip} ${cy - 4} h ${16 * flip} M ${cx - 9 * flip} ${cy + 3} h ${16 * flip}`} stroke={skinLine} strokeWidth={1.2} opacity={0.6} />
    </g>
  )
  switch (who) {
    case 'mara':
      return (
        <g>
          <path d="M 102 580 L 112 150" stroke="#6B4A2B" strokeWidth={9} strokeLinecap="round" />
          <path d="M 112 152 Q 116 112 92 110 Q 72 112 76 134" stroke="#6B4A2B" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M 110 300 L 112 160" stroke="#9A7044" strokeWidth={2.5} opacity={0.6} />
          {hand(110, 362, -1)}
        </g>
      )
    case 'sol':
      return (
        <g>
          <path d="M 268 420 Q 300 470 290 520" stroke="#2A2422" strokeWidth={3} fill="none" />
          <rect x={256} y={350} width={22} height={70} rx={8} fill="#2A2422" transform="rotate(-14 267 385)" />
          <ellipse cx={258} cy={346} rx={17} ry={20} fill="#6A6E74" stroke="#2A2422" strokeWidth={2.5} transform="rotate(-14 258 346)" />
          <path d="M 246 340 h 24 M 246 348 h 24 M 248 356 h 20" stroke="#3A3E44" strokeWidth={1.5} transform="rotate(-14 258 346)" />
          {hand(270, 400)}
        </g>
      )
    case 'tomas':
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M ${262 + i * 9} 420 L ${252 + i * 12} 330`} stroke="#E46A1E" strokeWidth={11} strokeLinecap="round" />
          ))}
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M ${252 + i * 12} 332 q ${-12 + i * 8} -30 ${-6 + i * 10} -48 M ${252 + i * 12} 332 q ${4 + i * 4} -26 ${14 + i * 6} -38`} stroke="#5B7F3A" strokeWidth={4} fill="none" strokeLinecap="round" />
          ))}
          {hand(270, 404)}
        </g>
      )
    case 'ines':
      return (
        <g>
          <g transform="rotate(10 268 400)">
            <rect x={240} y={360} width={60} height={78} rx={3} fill="#4E6A8C" stroke="#26364A" strokeWidth={2} />
            <rect x={244} y={364} width={52} height={70} fill="#FBF7F0" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M 250 ${378 + i * 11} h ${i % 2 ? 30 : 40}`} stroke="#7A8AA0" strokeWidth={1.6} />
            ))}
            <path d="M 236 362 v 76" stroke="#9AA0A6" strokeWidth={4} strokeDasharray="3 4" />
          </g>
          <path d="M 222 420 L 252 360" stroke="#C9302C" strokeWidth={5} strokeLinecap="round" />
          {hand(226, 414, -1)}
          {hand(290, 430)}
        </g>
      )
    default:
      return null
  }
}

export default function Figure({ character, expression, title }: { character: string; expression?: CathExpression; title?: string }) {
  const spec = CHARACTERS[character]
  if (!spec) return null
  const extra = EXTRA[character] ?? { iris: '#3A2A24', build: 1 }
  const mood = moodFor(expression, spec)
  const id = `fig-${character}`
  const skinLine = tone(spec.skin, -0.5)
  const skinShade = tone(spec.skin, -0.14)
  const skinLight = tone(spec.skin, 0.35)
  const cloth = spec.outfit
  const clothLine = tone(cloth, -0.55)
  const lip = tone(spec.skin, -0.3)
  const b = extra.build
  // Shoulders widen with build, around the centre line.
  const sx = (x: number) => 200 + (x - 200) * b
  const torso = `M ${sx(96)} 504 L ${sx(100)} 360 Q ${sx(104)} 300 ${sx(160)} 284 L ${sx(240)} 284 Q ${sx(296)} 300 ${sx(300)} 360 L ${sx(304)} 504 Z`
  const armL = `M ${sx(104)} 318 Q ${sx(84)} 360 ${sx(82)} 504 L ${sx(118)} 504 Q ${sx(118)} 400 ${sx(128)} 352 Z`
  const armR = `M ${sx(296)} 318 Q ${sx(316)} 360 ${sx(318)} 504 L ${sx(282)} 504 Q ${sx(282)} 400 ${sx(272)} 352 Z`
  const head = 'M 144 160 Q 142 92 200 88 Q 258 92 256 160 Q 256 208 226 232 Q 200 248 174 232 Q 144 208 144 160 Z'
  const browY = 146
  const brow = (cx: number, side: -1 | 1) => {
    const a = (mood.brow + mood.inner) * side
    return (
      <path
        d={`M ${cx - 15 * side} ${browY + 2} Q ${cx} ${browY - 5} ${cx + 15 * side} ${browY + 1} L ${cx + 14 * side} ${browY + 4} Q ${cx} ${browY - 1} ${cx - 15 * side} ${browY + 5} Z`}
        fill={tone(spec.hair, -0.45)}
        transform={`rotate(${-a} ${cx} ${browY})`}
      />
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 20 320 480"
      className={`fig fig-${character}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={`${id}-torso`}>
          <path d={torso} />
        </clipPath>
        <clipPath id={`${id}-head`}>
          <path d={head} />
        </clipPath>
        <linearGradient id={`${id}-cloth`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={tone(cloth, -0.18)} />
          <stop offset="0.55" stopColor={cloth} />
          <stop offset="1" stopColor={tone(cloth, 0.12)} />
        </linearGradient>
      </defs>
      <g className="fig-hair-back">
        <HairBack style={spec.hairStyle} c={spec.hair} />
      </g>
      <g className="fig-body">
        <path d={armL} fill={tone(cloth, -0.2)} stroke={clothLine} strokeWidth={2} />
        <path d={armR} fill={tone(cloth, 0.04)} stroke={clothLine} strokeWidth={2} />
        <path d={torso} fill={`url(#${id}-cloth)`} stroke={clothLine} strokeWidth={2.4} />
        <g clipPath={`url(#${id}-torso)`}>
          {/* shadow side and a rim light, cel style */}
          <path d={`M 0 280 L ${sx(150)} 280 Q ${sx(128)} 390 ${sx(140)} 520 L 0 520 Z`} fill="#180e0c" opacity={0.16} />
          <path d={`M ${sx(292)} 320 Q ${sx(300)} 420 ${sx(298)} 520`} stroke="#FFE7C6" strokeWidth={4} fill="none" opacity={0.5} />
          <Outfit kind={spec.accessory} base={cloth} accent={spec.outfitAccent} />
        </g>
        {/* held at chest height so the caption never hides it */}
        <g transform="translate(0 -60)">
          <Prop who={character} skin={spec.skin} skinLine={skinLine} />
        </g>
        {spec.accessory === 'clipboard' && (
          <g transform="rotate(-8 270 420)">
            <rect x={246} y={380} width={56} height={74} rx={4} fill="#B98A52" stroke="#5E3E1E" strokeWidth={2} />
            <rect x={252} y={388} width={44} height={60} fill="#FFFDF5" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M 258 ${400 + i * 9} h ${i % 2 ? 26 : 32}`} stroke="#8A7A6A" strokeWidth={1.6} />
            ))}
            <path d="M 258 400 l 3 3 l 5 -6" stroke="#6E7C4B" strokeWidth={2} fill="none" />
            <rect x={262} y={374} width={24} height={10} rx={2} fill="#9AA0A6" stroke="#4A4E52" strokeWidth={1.5} />
            <ellipse cx={sx(298)} cy={446} rx={14} ry={12} fill={spec.skin} stroke={skinLine} strokeWidth={1.8} />
          </g>
        )}
      </g>
      <g className="fig-head">
        {/* neck with the jaw's shadow across it */}
        <path d="M 182 220 L 181 286 Q 200 296 219 286 L 218 220 Z" fill={spec.skin} stroke={skinLine} strokeWidth={1.8} />
        <path d="M 180 236 Q 200 262 220 236 L 220 252 Q 200 274 180 252 Z" fill={skinShade} />
        {/* ears */}
        <ellipse cx={144} cy={170} rx={9} ry={15} fill={skinShade} stroke={skinLine} strokeWidth={1.8} />
        <ellipse cx={256} cy={170} rx={9} ry={15} fill={spec.skin} stroke={skinLine} strokeWidth={1.8} />
        <path d={head} fill={spec.skin} stroke={skinLine} strokeWidth={2.2} />
        <g clipPath={`url(#${id}-head)`}>
          <path d="M 130 90 Q 160 140 158 190 Q 164 226 200 250 L 130 260 Z" fill={skinShade} opacity={0.75} />
          <path d="M 250 130 Q 256 180 236 222" stroke={skinLight} strokeWidth={5} fill="none" opacity={0.7} />
          <ellipse cx={170} cy={190} rx={13} ry={7} fill="#F0908A" opacity={0.28} />
          <ellipse cx={232} cy={190} rx={13} ry={7} fill="#F0908A" opacity={0.28} />
          {extra.stubble && <path d="M 158 196 Q 166 236 200 244 Q 234 236 242 196 Q 232 226 200 230 Q 168 226 158 196 Z" fill={tone(spec.hair, 0.1)} opacity={0.22} />}
          {extra.freckles &&
            [[164, 184], [172, 180], [178, 188], [222, 180], [230, 186], [236, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.4} fill={skinLine} opacity={0.45} />)}
          {extra.lines && <path d="M 150 176 q 6 4 4 10 M 250 176 q -6 4 -4 10 M 180 128 q 20 -4 40 0" stroke={skinLine} strokeWidth={1.2} fill="none" opacity={0.4} />}
        </g>
        {brow(172, -1)}
        {brow(228, 1)}
        <Eye cx={172} side={-1} iris={extra.iris} kind={mood.eyes} line={skinLine} />
        <Eye cx={228} side={1} iris={extra.iris} kind={mood.eyes} line={skinLine} />
        <path d="M 202 172 Q 198 190 194 194 Q 200 198 208 194" stroke={skinLine} strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.75} />
        <Mouth kind={mood.mouth} lip={lip} line={tone(spec.skin, -0.6)} />
        <HairFront style={spec.hairStyle} c={spec.hair} />
      </g>
    </svg>
  )
}
