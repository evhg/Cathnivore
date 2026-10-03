// Cath, the face of every game on cathnivore.com (VISION.md "Cath: character bible"): a classy, cute,
// stylish mum. One framework-free renderer so the Cathnivore app (React), Runnel and the landing page all
// draw the same Cath. It returns SVG markup as a string. There are no inline style attributes (the site's
// CSP forbids them) and every gradient, clip, mask and pattern id is unique per call, so several Caths can
// share a page.
//
// Animation hooks (shared/cath/cath.css): .cath-lids (blink; hidden by default with opacity="0", so the
// art is right even without the CSS), .cath-hair-front (sway), .cath-body (breathing), .cath-head (tilt).
//
// Drawing style (owner feedback 2026-10-03, "the art is simplistic"): storybook cel shading. The key light
// comes from the viewer's right (she stands on the left of a story panel, facing the scene), so her shadow
// side is the viewer's left and a warm rim light catches her right-hand edges. Outlines are softer, darker
// tones of each material instead of one uniform ink, and the facial lines are tapered brush strokes
// (`brush`) rather than constant-width strokes. Hair detail is clipped to the hair shapes, so no strand can
// ever cross her skin.

export type CathExpression = 'smirk' | 'delighted' | 'determined' | 'worried' | 'wink'
export type CathOutfit = 'field' | 'market' | 'wax' | 'pinny' | 'gown'
export type CathFraming = 'face' | 'bust' | 'half'

export interface CathOptions {
  expression?: CathExpression
  outfit?: CathOutfit
  framing?: CathFraming
  /** Accessible name. Omit for decorative use (the SVG is then aria-hidden). */
  title?: string
  className?: string
  /** Optional pixel size attributes; otherwise size the SVG with CSS. */
  width?: number
  height?: number
  /** Idle animation: blink, hair sway, breathing (needs shared/cath/cath.css). */
  animate?: boolean
}

// OWNER.md sets her hair and skin colours.
const HAIR = '#2E211C'
const SKIN = '#F7DCCB'

const C = {
  ink: '#3A2A24',
  hairLine: '#170E0B',
  hairDeep: '#1A110E',
  hairMid: '#4A362D',
  hairShine: '#7E5D4D',
  hairGlint: '#B48C76',
  skinLine: '#A0614F',
  skinShade: '#EDBBA6',
  skinDeep: '#DC9C88',
  skinLight: '#FFF4EC',
  blush: '#F0908A',
  lip: '#C9566B',
  lipDeep: '#A63F55',
  lipLine: '#8A3447',
  lipShine: '#F8CDD4',
  white: '#FFFFFF',
  eyeWhite: '#FFFDFB',
  liner: '#221613',
  brow: '#2A1D18',
  rim: '#FFE7C6',
  olive: '#6E7C4B',
  oliveShade: '#56623A',
  oliveDeep: '#414B2B',
  oliveLight: '#86955F',
  oliveLine: '#2E3520',
  blouse: '#F7F0E3',
  blouseShade: '#E4D8C2',
  pearl: '#FBF7F0',
  pearlShade: '#DCD3C6',
  gold: '#D4AE58',
  goldLight: '#F3DC98',
  goldDeep: '#A57E2E',
  leaf: '#5B7F3A',
  leafLight: '#86AC5B',
  leafDeep: '#3E5C26',
  camel: '#C99A61',
  camelShade: '#AA7D48',
  camelLight: '#DDB47F',
  camelLine: '#6B4A26',
  knit: '#F1E6D0',
  knitShade: '#DCCDB0',
  knitLine: '#8C7A5A',
  teeth: '#FFFDF8',
  wax: '#2F3A2C',
  waxLight: '#4A5A44',
  waxLine: '#141A12',
  cord: '#7A4E2E',
  claret: '#6E1F33',
  claretLight: '#A8435C',
  claretLine: '#36101A',
}

const VIEWBOX: Record<CathFraming, string> = {
  face: '122 52 156 188',
  bust: '80 36 240 288',
  half: '40 20 320 480',
}

let uid = 0

export function cathSvg(options: CathOptions = {}): string {
  const expression = options.expression ?? 'smirk'
  const outfit = options.outfit ?? 'field'
  const framing = options.framing ?? 'bust'
  const id = `cath${++uid}`
  const a11y = options.title
    ? `role="img" aria-label="${escapeAttr(options.title)}"`
    : 'aria-hidden="true" focusable="false"'
  const cls = `cath cath-${expression} cath-${outfit}${options.animate ? ' cath-animate' : ''}${options.className ? ` ${options.className}` : ''}`
  const size = `${options.width ? ` width="${options.width}"` : ''}${options.height ? ` height="${options.height}"` : ''}`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX[framing]}"${size} class="${cls}" ${a11y}>
${defs(id)}
<g class="cath-hair-back">${hairBack(id)}</g>
<g class="cath-body">${OUTFITS[outfit](id)}</g>
<g class="cath-head">
${neck(id)}
${NECKWEAR[outfit](id)}
${face(id)}
${features(id, expression)}
${hairFront(id)}
${accessories(id, outfit)}
</g>
</svg>`
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

// ---- drawing helpers ----------------------------------------------------------------------------------------

type Pt = readonly [number, number]
const n1 = (v: number) => String(Math.round(v * 10) / 10)

/** A tapered brush stroke along a quadratic curve, as a filled shape: width w0 at the start, wm in the
 *  middle and w1 at the end. This is what gives the line work its hand-inked weight. */
function brush(p0: Pt, c: Pt, p1: Pt, w0: number, wm: number, w1: number, fill: string, extra = ''): string {
  const steps = 10
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0]
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]
    let dx = 2 * u * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0])
    let dy = 2 * u * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1])
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const w = Math.max(0.05, w0 * (1 - t) * (1 - 2 * t) + wm * 4 * t * (1 - t) + w1 * t * (2 * t - 1)) / 2
    left.push(`${n1(x - dy * w)} ${n1(y + dx * w)}`)
    right.push(`${n1(x + dy * w)} ${n1(y - dx * w)}`)
  }
  return `<path fill="${fill}"${extra} d="M${left.join(' L')} L${right.reverse().join(' L')} Z"/>`
}

/** A hair strand: a brush stroke that is thin at both ends. */
const strand = (p0: Pt, c: Pt, p1: Pt, w: number, fill: string, opacity: number) =>
  brush(p0, c, p1, 0.2, w, 0.1, fill, ` opacity="${opacity}"`)

/** The band of a shape left over when the shape, shifted by (dx, dy), is cut away: a cel-shaded shadow on
 *  the side the shift moves away from, or a rim light when the shift is a couple of pixels. */
function band(maskId: string, d: string, dx: number, dy: number, fill: string, opacity: number): string {
  return `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="520"><path fill="#fff" d="${d}"/><path fill="#000" transform="translate(${dx} ${dy})" d="${d}"/></mask>
<path fill="${fill}" opacity="${opacity}" mask="url(#${maskId})" d="${d}"/>`
}

const mirror = (f: 1 | -1) => (v: number) => n1(200 + (v - 200) * f)

// ---- defs ----------------------------------------------------------------------------------------------------

function defs(id: string): string {
  return `<defs>
<linearGradient id="${id}-hair" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="440">
  <stop offset="0" stop-color="${HAIR}"/><stop offset="0.45" stop-color="#33251F"/><stop offset="1" stop-color="${C.hairDeep}"/>
</linearGradient>
<linearGradient id="${id}-hairback" gradientUnits="userSpaceOnUse" x1="0" y1="60" x2="0" y2="320">
  <stop offset="0" stop-color="#261B17"/><stop offset="1" stop-color="#120B09"/>
</linearGradient>
<radialGradient id="${id}-shine" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="${C.hairShine}" stop-opacity="0.7"/><stop offset="1" stop-color="${C.hairShine}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="${id}-face" cx="0.62" cy="0.36" r="0.72">
  <stop offset="0" stop-color="#FCE8DB"/><stop offset="0.5" stop-color="${SKIN}"/><stop offset="1" stop-color="#F1CDB9"/>
</radialGradient>
<linearGradient id="${id}-side" gradientUnits="userSpaceOnUse" x1="144" y1="0" x2="256" y2="0">
  <stop offset="0" stop-color="${C.skinDeep}" stop-opacity="0.75"/><stop offset="0.2" stop-color="${C.skinShade}" stop-opacity="0.5"/><stop offset="0.36" stop-color="${C.skinShade}" stop-opacity="0"/><stop offset="0.9" stop-color="${C.skinShade}" stop-opacity="0"/><stop offset="1" stop-color="${C.skinShade}" stop-opacity="0.5"/>
</linearGradient>
<linearGradient id="${id}-jaw" gradientUnits="userSpaceOnUse" x1="0" y1="186" x2="0" y2="228">
  <stop offset="0" stop-color="${C.skinShade}" stop-opacity="0"/><stop offset="1" stop-color="${C.skinShade}" stop-opacity="0.65"/>
</linearGradient>
<linearGradient id="${id}-neck" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="${C.skinShade}"/><stop offset="0.45" stop-color="${SKIN}"/><stop offset="1" stop-color="#FBE6D9"/>
</linearGradient>
<radialGradient id="${id}-blush" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="${C.blush}" stop-opacity="0.75"/><stop offset="1" stop-color="${C.blush}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="${id}-lid" cx="0.5" cy="0.62" r="0.5">
  <stop offset="0" stop-color="#C98A7C" stop-opacity="0.55"/><stop offset="1" stop-color="#C98A7C" stop-opacity="0"/>
</radialGradient>
<radialGradient id="${id}-iris" cx="0.5" cy="0.68" r="0.6">
  <stop offset="0" stop-color="#C08A58"/><stop offset="0.4" stop-color="#83532F"/><stop offset="0.78" stop-color="#4E2E1D"/><stop offset="1" stop-color="#2A1810"/>
</radialGradient>
<linearGradient id="${id}-white" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#E9D3CC"/><stop offset="0.5" stop-color="${C.eyeWhite}"/><stop offset="1" stop-color="#F6ECE8"/>
</linearGradient>
<linearGradient id="${id}-lip" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${C.lipDeep}"/><stop offset="0.5" stop-color="${C.lip}"/><stop offset="1" stop-color="#DB7486"/>
</linearGradient>
<linearGradient id="${id}-olive" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.oliveShade}"/><stop offset="0.5" stop-color="${C.olive}"/><stop offset="1" stop-color="${C.oliveLight}"/>
</linearGradient>
<linearGradient id="${id}-lapel" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="${C.olive}"/><stop offset="1" stop-color="${C.oliveLight}"/>
</linearGradient>
<linearGradient id="${id}-camel" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.camelShade}"/><stop offset="0.5" stop-color="${C.camel}"/><stop offset="1" stop-color="${C.camelLight}"/>
</linearGradient>
<linearGradient id="${id}-blouse" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="${C.blouseShade}"/><stop offset="0.55" stop-color="${C.blouse}"/><stop offset="0.75" stop-color="#FFFDF8"/><stop offset="1" stop-color="${C.blouse}"/>
</linearGradient>
<linearGradient id="${id}-wax" x1="0" y1="0" x2="1" y2="0.6">
  <stop offset="0" stop-color="#232C21"/><stop offset="0.55" stop-color="${C.wax}"/><stop offset="0.8" stop-color="#3F4D3A"/><stop offset="1" stop-color="${C.wax}"/>
</linearGradient>
<linearGradient id="${id}-claret" x1="0" y1="0" x2="1" y2="0.4">
  <stop offset="0" stop-color="#4E1424"/><stop offset="0.5" stop-color="${C.claret}"/><stop offset="0.78" stop-color="#94324D"/><stop offset="1" stop-color="${C.claret}"/>
</linearGradient>
<linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.goldLight}"/><stop offset="0.5" stop-color="${C.gold}"/><stop offset="1" stop-color="${C.goldDeep}"/>
</linearGradient>
<linearGradient id="${id}-leaf" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.leafLight}"/><stop offset="0.6" stop-color="${C.leaf}"/><stop offset="1" stop-color="${C.leafDeep}"/>
</linearGradient>
<radialGradient id="${id}-pearl" cx="0.35" cy="0.3" r="0.7">
  <stop offset="0" stop-color="${C.white}"/><stop offset="0.6" stop-color="${C.pearl}"/><stop offset="1" stop-color="${C.pearlShade}"/>
</radialGradient>
<pattern id="${id}-twill" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(38)">
  <path d="M0 0 V5" stroke="#1E2412" stroke-width="1.1" opacity="0.22"/>
</pattern>
<pattern id="${id}-gab" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(-40)">
  <path d="M0 0 V4" stroke="#6B4A26" stroke-width="0.9" opacity="0.2"/>
</pattern>
<pattern id="${id}-rib" patternUnits="userSpaceOnUse" width="6" height="7">
  <path d="M0 0 L3 3.5 L6 0 M0 3.5 L3 7 L6 3.5" fill="none" stroke="${C.knitLine}" stroke-width="0.9" opacity="0.45"/>
</pattern>
<pattern id="${id}-cord" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(-30)">
  <path d="M0 0 V3" stroke="#3E2412" stroke-width="1.2" opacity="0.4"/>
</pattern>
<pattern id="${id}-quilt" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
  <path d="M0 0 H12 M0 0 V12" stroke="#22323E" stroke-width="1.4" opacity="0.6"/>
</pattern>
<pattern id="${id}-stripe" patternUnits="userSpaceOnUse" width="10" height="10">
  <path d="M2.5 0 V10" stroke="#8FA9D2" stroke-width="2.6" opacity="0.85"/>
</pattern>
<clipPath id="${id}-faceclip"><path d="${FACE}"/></clipPath>
<clipPath id="${id}-hf"><path d="${lockD(1)}"/><path d="${lockD(-1)}"/><path d="${CROWN}"/></clipPath>
<clipPath id="${id}-below"><rect x="0" y="108" width="400" height="420"/></clipPath>
<clipPath id="${id}-hb"><path d="${HAIR_BACK}"/></clipPath>
</defs>`
}

// ---- hair ------------------------------------------------------------------------------------------------

const HAIR_BACK = `M200 60
C154 58 126 90 124 144
C122 186 118 222 122 252
C126 278 120 296 128 314
L272 314
C280 296 274 278 278 252
C282 222 278 186 276 144
C274 90 246 58 200 60 Z`

const CROWN = 'M200 60 C174 60 156 70 148 86 C164 76 184 72 200 72 C216 72 236 76 252 86 C244 70 226 60 200 60 Z'

/** One of the two long front locks (f = 1: the viewer's left). The inner edge sweeps off the forehead as a
 *  curtain bang, then hugs the outside of the cheek, so the face stays clear. */
function lockD(f: 1 | -1): string {
  const x = mirror(f)
  return `M${x(200)} 66
C${x(182)} 64 ${x(160)} 72 ${x(148)} 90
C${x(136)} 108 ${x(133)} 132 ${x(134)} 156
C${x(135)} 180 ${x(131)} 200 ${x(129)} 222
C${x(125)} 250 ${x(145)} 268 ${x(143)} 296
C${x(141)} 322 ${x(157)} 340 ${x(151)} 368
C${x(147)} 390 ${x(159)} 408 ${x(153)} 430
C${x(169)} 420 ${x(175)} 402 ${x(171)} 382
C${x(167)} 360 ${x(177)} 340 ${x(169)} 314
C${x(161)} 290 ${x(167)} 270 ${x(157)} 244
C${x(151)} 226 ${x(150)} 198 ${x(150)} 174
C${x(149)} 150 ${x(154)} 128 ${x(165)} 114
C${x(180)} 106 ${x(193)} 94 ${x(200)} 78 Z`
}

function hairBack(id: string): string {
  // The mass behind her: it hugs the head, then falls behind the shoulders. A deeper tone than the front
  // locks so it reads as further back, an occlusion shadow behind the neck, a few strands and a rim light.
  const side = (f: 1 | -1) => {
    const x = (v: number) => 200 + (v - 200) * f
    const o = f === -1 ? 0.55 : 0.35
    return strand([x(140), 110], [x(128), 170], [x(134), 240], 2.4, C.hairShine, o * 0.7) +
      strand([x(132), 200], [x(126), 250], [x(134), 300], 2, C.hairMid, o) +
      brush([x(124), 236], [x(119), 252], [x(121), 270], 0.2, 1, 0.1, HAIR, ' opacity="0.7"')
  }
  return `<path fill="url(#${id}-hairback)" stroke="${C.hairLine}" stroke-width="2" stroke-linejoin="round" d="${HAIR_BACK}"/>
<g clip-path="url(#${id}-hb)">
<path fill="${C.hairDeep}" opacity="0.85" d="M158 214 C176 236 224 236 242 214 L250 320 L150 320 Z"/>
${band(`${id}-hbrim`, HAIR_BACK, -2, 0, C.hairGlint, 0.3)}
</g>
${side(1)}
${side(-1)}`
}

function hairFront(id: string): string {
  // Centre-parted curtain bangs and two long waved locks over the shoulders. Three tones (base, an
  // occluded inner edge, light strands), a broken shine band on the crown that follows the head's curve,
  // a rim light on the lit side and a few flyaways at the silhouette. Every detail is clipped to the hair.
  const L = lockD(1)
  const R = lockD(-1)
  const strands = (f: 1 | -1) => {
    const x = (v: number) => 200 + (v - 200) * f
    const lit = f === -1 ? 1 : 0.6
    return [
      strand([x(152), 96], [x(139), 128], [x(141), 168], 2.2, C.hairShine, 0.7 * lit),
      strand([x(146), 182], [x(138), 212], [x(142), 240], 2, C.hairShine, 0.55 * lit),
      strand([x(146), 256], [x(160), 278], [x(155), 306], 3, C.hairShine, 0.75 * lit),
      strand([x(156), 330], [x(166), 350], [x(160), 374], 2.6, C.hairShine, 0.7 * lit),
      strand([x(160), 392], [x(166), 406], [x(160), 422], 1.8, C.hairShine, 0.6 * lit),
      strand([x(156), 108], [x(146), 150], [x(144), 200], 1.4, C.hairDeep, 0.8),
      strand([x(136), 226], [x(148), 262], [x(150), 292], 1.6, C.hairDeep, 0.8),
      strand([x(150), 310], [x(160), 330], [x(156), 354], 1.4, C.hairDeep, 0.7),
      strand([x(176), 84], [x(160), 96], [x(152), 118], 1.6, C.hairShine, 0.5 * lit),
    ].join('')
  }
  const shine = [
    strand([158, 102], [166, 88], [184, 82], 3.4, C.hairShine, 0.55),
    strand([166, 106], [174, 96], [190, 90], 2, C.hairShine, 0.4),
    strand([214, 82], [234, 86], [244, 102], 4, C.hairGlint, 0.6),
    strand([212, 90], [228, 94], [238, 108], 2.4, C.hairGlint, 0.45),
    strand([244, 112], [250, 124], [251, 140], 2.2, C.hairGlint, 0.4),
  ].join('')
  const flyaways = [
    brush([190, 62], [180, 57], [170, 61], 0.2, 0.9, 0.1, HAIR, ' opacity="0.8"'),
    brush([212, 62], [224, 57], [234, 63], 0.2, 0.9, 0.1, HAIR, ' opacity="0.8"'),
  ].join('')
  return `<g class="cath-hair-front">
${flyaways}
<path fill="url(#${id}-hair)" stroke="${C.hairLine}" stroke-width="2" stroke-linejoin="round" d="${L}"/>
<path fill="url(#${id}-hair)" stroke="${C.hairLine}" stroke-width="2" stroke-linejoin="round" d="${R}"/>
<path fill="url(#${id}-hair)" d="${CROWN}"/>
<g clip-path="url(#${id}-hf)">
<g clip-path="url(#${id}-below)">
${band(`${id}-occL`, L, -7, 0, C.hairDeep, 0.85)}
${band(`${id}-occR`, R, 7, 0, C.hairDeep, 0.85)}
${band(`${id}-litR`, R, -9, 0, C.hairMid, 0.4)}
</g>
<ellipse cx="208" cy="88" rx="44" ry="11" fill="url(#${id}-shine)"/>
${shine}
${strands(1)}
${strands(-1)}
${band(`${id}-rimR`, R, -2, 0, C.hairGlint, 0.4)}
</g>
${brush([200, 62], [200, 72], [200, 84], 1.8, 1.4, 0.3, C.hairDeep)}
</g>`
}

// ---- face ------------------------------------------------------------------------------------------------

const FACE = `M200 228
C188 228 172 220 162 205
C152 189 146 166 146 138
C146 102 168 72 200 72
C232 72 254 102 254 138
C254 166 248 189 238 205
C228 220 212 228 200 228 Z`

const NECK = 'M185 206 C186 228 185 242 181 258 L219 258 C215 242 214 228 215 206 Z'

function neck(id: string): string {
  return `<path fill="url(#${id}-neck)" d="${NECK}"/>
<path fill="none" stroke="${C.skinLine}" stroke-width="1.8" stroke-linecap="round" d="M185 206 C186 228 185 242 181 258 M215 206 C214 228 215 242 219 258"/>
<path fill="${C.skinShade}" d="M185 212 C192 228 208 230 215 212 L215 234 C206 242 194 242 185 232 Z"/>
<path fill="${C.skinDeep}" opacity="0.55" d="M186 216 C193 228 207 229 214 216 L214 222 C206 232 194 232 186 224 Z"/>
${brush([214, 236], [214, 246], [217, 256], 0.2, 1.6, 0.2, C.rim, ' opacity="0.8"')}`
}

function face(id: string): string {
  // Base, then cel shadows clipped to the face: the shadow side and jaw, a soft shade under the lit
  // cheekbone, the bangs' cast shadow on the forehead, then highlights and the outline on top.
  return `<path fill="url(#${id}-face)" d="${FACE}"/>
<g clip-path="url(#${id}-faceclip)">
<rect x="140" y="60" width="120" height="180" fill="url(#${id}-side)"/>
<rect x="140" y="60" width="120" height="180" fill="url(#${id}-jaw)"/>
<path fill="${C.skinShade}" opacity="0.85" transform="translate(5 6)" d="${lockD(1)}"/>
<path fill="${C.skinShade}" opacity="0.7" transform="translate(-3 5)" d="${lockD(-1)}"/>
<ellipse cx="214" cy="100" rx="13" ry="6" fill="${C.skinLight}" opacity="0.6"/>
<ellipse cx="236" cy="166" rx="8" ry="4.5" fill="${C.skinLight}" opacity="0.35" transform="rotate(-20 236 166)"/>
<ellipse cx="205" cy="219" rx="5" ry="1.8" fill="${C.skinLight}" opacity="0.4"/>
</g>
<path fill="none" stroke="${C.skinLine}" stroke-width="1.8" stroke-linejoin="round" d="${FACE}"/>`
}

type EyeVariant = 'open' | 'closed-happy' | 'closed-wink' | 'narrow'

function eye(id: string, cx: number, flip: 1 | -1, variant: EyeVariant): string {
  // flip = -1 for her right eye (viewer's left) so the liner wing and lashes point outwards.
  const x = (dx: number) => cx + dx * flip
  const p = (dx: number, y: number): Pt => [x(dx), y]
  const y0 = 153
  if (variant === 'closed-happy' || variant === 'closed-wink') {
    const lift = variant === 'closed-happy' ? -7 : -5
    return `<ellipse cx="${x(0)}" cy="${y0 - 4}" rx="17" ry="7" fill="url(#${id}-lid)"/>
${brush(p(-13, y0), p(0, y0 + lift), p(13.5, y0), 1, 3.8, 2.4, C.liner)}
${brush(p(12.5, y0 - 0.5), p(16, y0 - 2.5), p(19, y0 - 5.5), 2.2, 1.4, 0.2, C.liner)}
${brush(p(8, y0 - 3), p(9.5, y0 - 6), p(12, y0 - 8.5), 1.6, 1, 0.2, C.liner)}
${brush(p(-9, y0 + 3), p(0, y0 + 6), p(9, y0 + 3), 0.2, 1, 0.2, C.skinDeep, ' opacity="0.8"')}`
  }
  const top = variant === 'narrow' ? y0 - 4 : y0 - 11
  const white = `M${n1(x(-13.5))} ${y0} Q${n1(x(-1))} ${top} ${n1(x(14))} ${y0 - 1} Q${n1(x(1))} ${y0 + 10} ${n1(x(-13.5))} ${y0} Z`
  const clip = `${id}-eye${flip === 1 ? 'r' : 'l'}`
  return `<g class="cath-eye">
<ellipse cx="${x(1)}" cy="${y0 - 5}" rx="18" ry="${variant === 'narrow' ? 6 : 9}" fill="url(#${id}-lid)"/>
${brush(p(-11, top - 1), p(0, top - 7), p(13, y0 - 9), 0.2, 1.3, 0.2, C.skinLine, ' opacity="0.55"')}
<clipPath id="${clip}"><path d="${white}"/></clipPath>
<path fill="url(#${id}-white)" d="${white}"/>
<g clip-path="url(#${clip})">
<circle cx="${x(1)}" cy="${y0 + 0.5}" r="8.6" fill="url(#${id}-iris)"/>
<circle cx="${x(1)}" cy="${y0 + 0.5}" r="8.6" fill="none" stroke="#24140D" stroke-width="1" opacity="0.8"/>
<circle cx="${x(1)}" cy="${y0 + 0.5}" r="4" fill="${C.liner}"/>
<ellipse cx="${x(1)}" cy="${top + 1}" rx="15" ry="6" fill="#3A2018" opacity="0.4"/>
<circle cx="${x(-2.4)}" cy="${y0 - 3.2}" r="2.9" fill="${C.white}"/>
<circle cx="${x(4.2)}" cy="${y0 + 3.6}" r="1.3" fill="${C.white}" opacity="0.9"/>
</g>
${brush(p(-14.5, y0 - 0.2), p(-1, top - 3), p(14.5, y0 - 1.5), 1.2, 3.4, 3.8, C.liner)}
${brush(p(13.5, y0 - 1.2), p(17, y0 - 3.5), p(20.5, y0 - 7), 3, 1.8, 0.2, C.liner)}
${brush(p(5, top - 0.5), p(6.5, top - 4), p(8.5, top - 6.5), 1.6, 1, 0.2, C.liner)}
${brush(p(9.5, y0 - 6.5), p(11.5, y0 - 9.5), p(14, y0 - 11.5), 1.7, 1.1, 0.2, C.liner)}
${brush(p(13.5, y0 - 3.5), p(16, y0 - 6), p(18.5, y0 - 8.5), 1.6, 1, 0.2, C.liner)}
${brush(p(-2, y0 + 6.6), p(5, y0 + 7.6), p(12, y0 + 4.2), 0.2, 0.9, 0.5, C.skinLine, ' opacity="0.4"')}
${brush(p(11, y0 + 4.2), p(13, y0 + 4.6), p(15.5, y0 + 6.5), 0.9, 0.7, 0.1, C.liner, ' opacity="0.7"')}
<path class="cath-lids" opacity="0" fill="${C.skinShade}" stroke="${C.liner}" stroke-width="2.4" d="M${n1(x(-15))} ${y0} Q${n1(x(-1))} ${top - 3} ${n1(x(15))} ${y0 - 1} Q${n1(x(1))} ${y0 + 10.5} ${n1(x(-15))} ${y0} Z"/>
</g>`
}

function brows(expression: CathExpression): string {
  // Viewer's left then right. Her viewer-right brow sits a touch higher by default (she's sharp, not just
  // sweet). Determined and worried push their control points well away from smirk's baseline, so the two
  // stay readable at companion/portrait scale (a gate-8 finding). Each brow is a filled brush stroke: full
  // at the inner head, tapering to a fine tail.
  const shapes: Record<CathExpression, [Pt, Pt, Pt, Pt, Pt, Pt]> = {
    smirk: [[159, 131], [172, 124], [186, 129], [214, 127], [228, 118], [242, 124]],
    wink: [[159, 133], [172, 127], [186, 131], [214, 125], [228, 116], [242, 122]],
    delighted: [[159, 128], [172, 120], [186, 125], [214, 125], [228, 120], [241, 128]],
    determined: [[159, 124], [173, 130], [187, 140], [213, 140], [227, 130], [241, 124]],
    worried: [[160, 138], [172, 130], [186, 120], [214, 120], [228, 130], [240, 138]],
  }
  const [a, b, c, d, e, f] = shapes[expression]
  return `${brush(a, b, c, 0.8, 3.4, 3.6, C.brow, ' opacity="0.95"')}
${brush(d, e, f, 3.6, 3.4, 0.8, C.brow, ' opacity="0.95"')}
${brush([c[0] - 9, c[1] - 1], [c[0] - 4, c[1] - 2], [c[0], c[1]], 0.4, 1.4, 0.4, '#6A4A3C', ' opacity="0.5"')}`
}

function mouth(id: string, expression: CathExpression): string {
  const lips = `fill="url(#${id}-lip)" stroke="${C.lipLine}" stroke-width="1.1" stroke-linejoin="round"`
  const philtrum = `<path fill="${C.skinShade}" opacity="0.6" d="M197 186 Q200 189 203 186 L202 191 Q200 192 198 191 Z"/>`
  switch (expression) {
    case 'delighted':
      return `${philtrum}<path fill="#7A2A3A" stroke="${C.lipLine}" stroke-width="1.2" stroke-linejoin="round" d="M184 192 Q200 196 216 192 Q212 210 200 210 Q188 210 184 192 Z"/>
<path fill="${C.teeth}" d="M187 193.5 Q200 197 213 193.5 Q212 199 200 199.5 Q188 199 187 193.5 Z"/>
<path fill="#E07A8C" d="M192 205.5 Q200 202 208 205.5 Q205 209.5 200 209.8 Q195 209.5 192 205.5 Z"/>
<path fill="${C.lip}" d="M190 204.5 Q200 211.5 210 204.5 Q206 210 200 210.2 Q194 210 190 204.5 Z"/>
<ellipse cx="203" cy="208" rx="3" ry="0.9" fill="${C.lipShine}" opacity="0.8"/>
${brush([181, 190], [182, 193], [184, 195], 0.2, 1.1, 0.2, C.skinDeep)}${brush([219, 190], [218, 193], [216, 195], 0.2, 1.1, 0.2, C.skinDeep)}`
    case 'worried':
      // A deeper frown than before, so it reads at a glance rather than blending into determined's line.
      return `${philtrum}<path ${lips} d="M190 200 Q200 191 210 200 Q200 204.5 190 200 Z"/>
${brush([191, 199.6], [200, 196], [209, 199.6], 0.3, 1.2, 0.3, C.lipLine)}
<ellipse cx="200" cy="201.6" rx="3" ry="0.9" fill="${C.lipShine}"/>
<ellipse cx="200" cy="207" rx="5" ry="1.6" fill="${C.skinShade}" opacity="0.7"/>`
    case 'determined':
      // A flatter, firmer press than the default smirk: set-jaw resolve rather than ease.
      return `${philtrum}<path ${lips} d="M186 197.5 Q193 194.5 200 196 Q207 194.5 214 197.5 Q207 201 200 201 Q193 201 186 197.5 Z"/>
${brush([186.5, 197.6], [200, 198.6], [213.5, 197.6], 0.3, 1.3, 0.3, C.lipLine)}
<ellipse cx="202" cy="199.6" rx="3.6" ry="0.9" fill="${C.lipShine}"/>
<ellipse cx="200" cy="206" rx="6" ry="1.8" fill="${C.skinShade}" opacity="0.7"/>`
    default:
      // A warm smirk: the viewer-right corner lifts.
      return `${philtrum}<path ${lips} d="M187 197 Q194 192.5 200 195 Q207 191.5 215.5 192.5 Q209 203.5 200 203 Q192 203 187 197 Z"/>
${brush([187.5, 197], [200, 199.4], [215, 193], 0.3, 1.3, 0.4, C.lipLine)}
<ellipse cx="203" cy="200.6" rx="4" ry="1.2" fill="${C.lipShine}"/>
<ellipse cx="201" cy="207.5" rx="6" ry="1.8" fill="${C.skinShade}" opacity="0.7"/>
${brush([215.5, 191.5], [219.5, 192], [218.5, 196], 0.3, 1.3, 0.2, C.skinDeep)}`
  }
}

function nose(): string {
  return `${brush([196.5, 158], [193, 170], [195, 177], 0.2, 2, 0.6, C.skinShade)}
<path fill="${C.skinShade}" opacity="0.8" d="M193 177 Q200 185 207 177 Q204 181.5 200 182 Q196 181.5 193 177 Z"/>
${brush([194, 178.5], [200, 182.5], [206, 178], 0.3, 1.5, 0.3, C.skinLine)}
<ellipse cx="196.4" cy="179.2" rx="1.4" ry="0.8" fill="${C.skinDeep}"/>
<ellipse cx="203.6" cy="179.2" rx="1.4" ry="0.8" fill="${C.skinDeep}"/>
<ellipse cx="202" cy="175" rx="2.2" ry="1.5" fill="${C.white}" opacity="0.7"/>
<ellipse cx="201.4" cy="160" rx="1" ry="5" fill="${C.white}" opacity="0.35"/>`
}

function features(id: string, expression: CathExpression): string {
  const leftEye: EyeVariant = expression === 'delighted' ? 'closed-happy' : expression === 'determined' ? 'narrow' : 'open'
  const rightEye: EyeVariant =
    expression === 'delighted' ? 'closed-happy' : expression === 'wink' ? 'closed-wink' : expression === 'determined' ? 'narrow' : 'open'
  const blushOpacity = expression === 'delighted' || expression === 'wink' ? 0.95 : 0.65
  return `<g class="cath-features">
<ellipse cx="165" cy="181" rx="15" ry="8.5" fill="url(#${id}-blush)" opacity="${blushOpacity}"/>
<ellipse cx="235" cy="181" rx="15" ry="8.5" fill="url(#${id}-blush)" opacity="${blushOpacity}"/>
${eye(id, 171, -1, leftEye)}
${eye(id, 229, 1, rightEye)}
${brows(expression)}
${nose()}
${mouth(id, expression)}
</g>`
}

// ---- outfits and accessories -------------------------------------------------------------------------------

// Shared tailored silhouette: sloped shoulders, a nipped waist and a slight flare at the hip.
const JACKET = `M183 250
C160 256 132 262 118 280
C106 296 104 322 106 350
C108 384 118 404 124 424
C128 446 120 472 116 500
L284 500
C280 472 272 446 276 424
C282 404 292 384 294 350
C296 322 294 296 282 280
C268 262 240 256 217 250
L200 404
L183 250 Z`

/** A garment body with its cel shading: fill, an optional texture, the shadow side, the shadow the locks
 *  cast on it, and a rim light along the lit edge. */
function garment(id: string, key: string, d: string, fill: string, line: string, shadow: string, texture = ''): string {
  return `<path fill="${fill}" stroke="${line}" stroke-width="2" stroke-linejoin="round" d="${d}"/>
${texture ? `<path fill="url(#${id}-${texture})" d="${d}"/>` : ''}
${band(`${id}-${key}sh`, d, 34, 0, shadow, 0.5)}
<clipPath id="${id}-${key}clip"><path d="${d}"/></clipPath>
<g clip-path="url(#${id}-${key}clip)" opacity="0.28">
<path fill="#160C08" transform="translate(-4 6)" d="${lockD(1)}"/>
<path fill="#160C08" transform="translate(-4 6)" d="${lockD(-1)}"/>
<path fill="#160C08" d="M178 252 C186 266 214 266 222 252 L222 262 C212 276 188 276 178 262 Z"/>
</g>
${band(`${id}-${key}rim`, d, -3, 2, C.rim, 0.55)}`
}

function fieldOutfit(id: string): string {
  // A tailored olive blazer (sloped shoulders, nipped waist, notched lapels, one button) over a cream silk
  // blouse, with a fine gold chain and a small leaf pendant. The collar stands up behind her neck.
  const lapel = (f: 1 | -1) => {
    const x = mirror(f)
    return `M${x(183)} 250 L${x(160)} 268 L${x(168)} 282 L${x(158)} 290 L200 404 Z`
  }
  const stitch = `fill="none" stroke="${C.oliveLight}" stroke-width="0.9" stroke-dasharray="2.2 2" opacity="0.8"`
  return `<path fill="url(#${id}-olive)" stroke="${C.oliveLine}" stroke-width="2" stroke-linejoin="round" d="M174 258 C173 250 174 243 177 238 C186 245 214 245 223 238 C226 243 227 250 226 258 Z"/>
<path fill="${C.oliveDeep}" opacity="0.6" d="M177 238 C186 245 214 245 223 238 L224 246 C214 252 186 252 176 246 Z"/>
<path fill="url(#${id}-blouse)" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round" d="M182 250 C194 256 206 256 218 250 L222 420 L178 420 Z"/>
${brush([208, 268], [212, 300], [206, 336], 0.3, 2.6, 0.3, C.white, ' opacity="0.7"')}
<path fill="${SKIN}" stroke="${C.skinLine}" stroke-width="1.4" stroke-linejoin="round" d="M181 250 C192 256 208 256 219 250 L200 300 Z"/>
<path fill="${C.skinShade}" d="M182 251 C192 258 208 258 218 251 L215 259 C206 266 194 266 185 259 Z"/>
<path fill="${C.skinShade}" opacity="0.7" d="M182 251 L200 300 L190 268 Z"/>
${brush([187, 263], [192, 265], [197, 267], 0.2, 1, 0.2, C.skinDeep, ' opacity="0.7"')}${brush([203, 267], [208, 265], [213, 263], 0.2, 1, 0.2, C.skinDeep, ' opacity="0.7"')}
<path fill="none" stroke="url(#${id}-gold)" stroke-width="1.3" d="M183 254 Q200 282 217 254"/>
<path fill="url(#${id}-leaf)" stroke="${C.leafDeep}" stroke-width="0.9" d="M200 274 C195 279 196 286 200 289 C204 286 205 279 200 274 Z"/>
<path fill="none" stroke="${C.leafLight}" stroke-width="0.6" d="M200 276 L200 287"/>
<circle cx="201.6" cy="279" r="0.9" fill="${C.white}" opacity="0.8"/>
${garment(id, 'jk', JACKET, `url(#${id}-olive)`, C.oliveLine, C.oliveDeep, 'twill')}
${brush([140, 300], [146, 360], [134, 500], 0.4, 2.4, 0.4, C.oliveDeep, ' opacity="0.8"')}
${brush([260, 300], [254, 360], [266, 500], 0.4, 2.2, 0.4, C.oliveDeep, ' opacity="0.6"')}
<path ${stitch} d="M132 272 C122 292 120 318 124 344 M268 272 C278 292 280 318 276 344"/>
${brush([148, 344], [136, 356], [140, 374], 0.3, 2.2, 0.3, C.oliveDeep, ' opacity="0.7"')}
${brush([252, 344], [264, 356], [260, 374], 0.3, 2, 0.3, C.oliveDeep, ' opacity="0.5"')}
${brush([176, 424], [172, 460], [178, 500], 0.3, 1.8, 0.3, C.oliveDeep, ' opacity="0.7"')}
${brush([224, 424], [228, 460], [222, 500], 0.3, 1.8, 0.3, C.oliveDeep, ' opacity="0.6"')}
<path fill="${C.oliveShade}" stroke="${C.oliveLine}" stroke-width="1.3" stroke-linejoin="round" d="M134 448 L168 452 L167 462 L135 458 Z M266 448 L232 452 L233 462 L265 458 Z"/>
<path fill="${C.oliveDeep}" opacity="0.8" transform="translate(-3 4)" d="${lapel(1)}"/>
<path fill="${C.oliveDeep}" opacity="0.6" transform="translate(-3 4)" d="${lapel(-1)}"/>
<path fill="url(#${id}-lapel)" stroke="${C.oliveLine}" stroke-width="1.6" stroke-linejoin="round" d="${lapel(1)}"/>
<path fill="url(#${id}-lapel)" stroke="${C.oliveLine}" stroke-width="1.6" stroke-linejoin="round" d="${lapel(-1)}"/>
<path ${stitch} d="M184 255 L164 269 M216 255 L236 269"/>
${brush([218, 254], [232, 262], [238, 268], 0.3, 1.6, 0.3, C.rim, ' opacity="0.7"')}
${brush([222, 292], [212, 340], [203, 392], 0.3, 1.6, 0.3, C.rim, ' opacity="0.45"')}
<circle cx="200" cy="418" r="4.6" fill="${C.oliveShade}" stroke="${C.oliveLine}" stroke-width="1.3"/>
<circle cx="201.4" cy="416.6" r="1.4" fill="${C.oliveLight}"/>
${hands(id, C.oliveDeep, 404)}`
}

function waxOutfit(id: string): string {
  // A waxed country jacket in deep green (with the wax's crumpled sheen), a brown corduroy collar turned
  // up, brass poppers, a quilted navy gilet at the front and a cream roll-neck: the farm in October.
  const coat = JACKET.replace('L200 404', 'L200 300')
  const collar = 'M181 246 L154 262 L162 284 L184 270 Z M219 246 L246 262 L238 284 L216 270 Z'
  return `${garment(id, 'wx', coat, `url(#${id}-wax)`, C.waxLine, '#141A12')}
${brush([124, 300], [118, 350], [124, 400], 0.3, 2.4, 0.3, C.waxLight, ' opacity="0.6"')}
${brush([278, 296], [284, 340], [278, 392], 0.3, 3, 0.3, '#6E8264', ' opacity="0.6"')}
${brush([262, 304], [270, 318], [266, 334], 0.3, 2, 0.3, '#6E8264', ' opacity="0.5"')}
${brush([244, 340], [258, 350], [262, 364], 0.3, 1.8, 0.3, '#6E8264', ' opacity="0.45"')}
${brush([142, 330], [150, 346], [146, 362], 0.3, 1.6, 0.3, C.waxLight, ' opacity="0.4"')}
<path fill="#3E5A6E" stroke="#1E2C36" stroke-width="1.8" stroke-linejoin="round" d="M186 296 L200 300 L214 296 L216 420 L184 420 Z"/>
<path fill="url(#${id}-quilt)" d="M186 296 L200 300 L214 296 L216 420 L184 420 Z"/>
<path fill="#5C7C92" opacity="0.5" d="M206 298 L214 296 L216 420 L208 420 Z"/>
<path fill="none" stroke="#1F281E" stroke-width="2" stroke-linecap="round" d="M182 300 L182 500 M218 300 L218 500"/>
<path fill="none" stroke="#5C6E55" stroke-width="0.8" stroke-dasharray="2 2" d="M178 302 L178 500 M222 302 L222 500"/>
${[318, 352, 386].map((y) => `<circle cx="180" cy="${y}" r="3.2" fill="url(#${id}-gold)" stroke="${C.waxLine}" stroke-width="1"/>`).join('')}
<path fill="#25301F" stroke="${C.waxLine}" stroke-width="1.6" d="M136 360 L166 356 L168 384 L138 388 Z M264 360 L234 356 L232 384 L262 388 Z"/>
<path fill="#4A2E18" opacity="0.8" transform="translate(-2 4)" d="${collar}"/>
<path fill="${C.cord}" stroke="#3A2210" stroke-width="1.6" stroke-linejoin="round" d="${collar}"/>
<path fill="url(#${id}-cord)" d="${collar}"/>
${brush([222, 249], [236, 256], [244, 263], 0.3, 1.6, 0.3, '#C08A5E', ' opacity="0.8"')}
${hands(id, '#1F281E', 404)}`
}

function pinnyOutfit(id: string): string {
  // Market-day baking: a striped cotton blouse with rolled sleeves under a rose-print pinafore, a little
  // ruffle at the bib, and a dusting of flour on the apron.
  const blouse = JACKET.replace('L200 404', 'L200 268')
  const apron = 'M164 300 C176 292 224 292 236 300 L240 420 C246 452 252 478 256 500 L144 500 C148 478 154 452 160 420 Z'
  return `${garment(id, 'pn', blouse, '#F7F2F5', '#5A4A55', '#B9AFC4', 'stripe')}
<path fill="#FFFDF8" stroke="#8C7A80" stroke-width="1.2" stroke-linejoin="round" d="M181 250 C192 256 208 256 219 250 C225 259 214 271 200 262 C186 271 175 259 181 250 Z"/>
<path fill="none" stroke="#E7A9B6" stroke-width="0.8" stroke-dasharray="1.6 1.4" d="M184 253 C180 260 190 266 199 260 M216 253 C220 260 210 266 201 260"/>
<path fill="none" stroke="#E7A9B6" stroke-width="2.2" d="M164 300 L150 262 M236 300 L250 262"/>
<path fill="#B9707E" opacity="0.5" transform="translate(-2 4)" d="${apron}"/>
<path fill="#F2C6CF" stroke="#7A3A48" stroke-width="1.8" stroke-linejoin="round" d="${apron}"/>
${band(`${id}-apsh`, apron, 26, 0, '#D898A6', 0.6)}
<path fill="none" stroke="${C.white}" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="3 2.4" d="M166 300 Q200 288 234 300"/>
<path fill="none" stroke="#E7A9B6" stroke-width="0.9" stroke-dasharray="2 2" d="M164 310 Q200 300 236 310"/>
${[[176, 330], [214, 346], [190, 380], [226, 402], [172, 424], [206, 452], [236, 468], [180, 478]]
  .map(([x = 0, y = 0]) => `<circle cx="${x}" cy="${y}" r="5" fill="#C9566B"/><circle cx="${x - 1.4}" cy="${y - 1.4}" r="1.8" fill="#E88A9B"/><path fill="${C.leafLight}" d="M${x + 4} ${y + 2} q5 -1 6 3 q-5 1 -6 -3Z"/>`)
  .join('')}
<path fill="#E7A9B6" stroke="#7A3A48" stroke-width="1.4" d="M184 404 L216 404 L218 430 L182 430 Z"/>
<ellipse cx="226" cy="440" rx="10" ry="6" fill="${C.white}" opacity="0.55"/><ellipse cx="232" cy="446" rx="4" ry="2.4" fill="${C.white}" opacity="0.5"/>
${band(`${id}-aprim`, apron, -2.5, 1.5, C.white, 0.6)}
${hands(id, '#8FA9D2', 404)}`
}

function gownOutfit(id: string): string {
  // Kingsmarket, the night it's won: a deep claret satin wrap gown with a modest crossover neckline, a fine
  // gold brooch at the waist and a sheer champagne wrap over her shoulders. Elegant, never showy.
  const gown = JACKET.replace('L200 404', 'L200 292')
  return `${garment(id, 'gw', gown, `url(#${id}-claret)`, C.claretLine, '#3A0E19')}
<path fill="${SKIN}" stroke="${C.skinLine}" stroke-width="1.4" stroke-linejoin="round" d="M181 250 C192 256 208 256 219 250 L200 292 Z"/>
<path fill="${C.skinShade}" d="M182 251 C192 258 208 258 218 251 L214 259 C206 266 194 266 186 259 Z"/>
<path fill="#3A0E19" opacity="0.6" transform="translate(-2 4)" d="M181 250 L200 292 L238 380 L214 384 Z"/>
<path fill="#8E2C45" stroke="${C.claretLine}" stroke-width="1.6" stroke-linejoin="round" d="M181 250 L200 292 L238 380 L214 384 Z"/>
${brush([190, 268], [208, 320], [224, 368], 0.3, 3, 0.3, '#C9667F', ' opacity="0.7"')}
${brush([140, 318], [146, 380], [134, 500], 0.4, 3, 0.4, '#3A0E19', ' opacity="0.6"')}
${brush([262, 316], [256, 380], [266, 500], 0.4, 4, 0.4, C.claretLight, ' opacity="0.55"')}
${brush([246, 420], [252, 456], [248, 496], 0.3, 2.4, 0.3, '#C9667F', ' opacity="0.45"')}
<path fill="none" stroke="url(#${id}-gold)" stroke-width="1.2" d="M186 254 Q200 276 214 254"/>
<circle cx="200" cy="270" r="3" fill="url(#${id}-pearl)" stroke="${C.ink}" stroke-width="0.8"/>
<g transform="translate(226 388)"><circle r="7" fill="url(#${id}-gold)" stroke="${C.claretLine}" stroke-width="1.2"/><circle r="3.2" fill="#F6E7B8"/><circle cx="-1" cy="-1" r="1.2" fill="${C.white}"/></g>
<path fill="#F3E3C8" fill-opacity="0.5" stroke="#D9C39C" stroke-width="1.2" d="M118 280 C140 258 168 254 183 252 C170 300 150 360 132 430 C122 400 112 330 118 280 Z M282 280 C260 258 232 254 217 252 C230 300 250 360 268 430 C278 400 288 330 282 280 Z"/>
<path fill="none" stroke="#FFF6E6" stroke-width="1" opacity="0.6" d="M128 290 C140 330 140 380 134 420 M272 290 C262 330 260 380 266 420"/>
${hands(id, '#4E1424', 404)}`
}

function marketOutfit(id: string): string {
  // A camel trench (gabardine twill) with wide lapels and a belted waist; the knit scarf is drawn in
  // NECKWEAR so it wraps over the neck.
  const coat = JACKET.replace('L200 404', 'L200 380')
  const lapel = (f: 1 | -1) => {
    const x = mirror(f)
    return `M${x(183)} 250 L${x(150)} 276 L${x(162)} 292 L${x(148)} 304 L200 380 Z`
  }
  return `<path fill="url(#${id}-blouse)" stroke="${C.ink}" stroke-width="1.6" d="M182 254 L218 254 L222 420 L178 420 Z"/>
${garment(id, 'tr', coat, `url(#${id}-camel)`, C.camelLine, '#7E5A2E', 'gab')}
<path fill="#7E5A2E" opacity="0.6" transform="translate(-3 4)" d="${lapel(1)}"/>
<path fill="#7E5A2E" opacity="0.45" transform="translate(-3 4)" d="${lapel(-1)}"/>
<path fill="${C.camel}" stroke="${C.camelLine}" stroke-width="1.6" stroke-linejoin="round" d="${lapel(1)}"/>
<path fill="${C.camelLight}" stroke="${C.camelLine}" stroke-width="1.6" stroke-linejoin="round" d="${lapel(-1)}"/>
<path fill="none" stroke="${C.camelShade}" stroke-width="0.9" stroke-dasharray="2.2 2" d="M178 258 L156 276 M222 258 L244 276 M120 300 C116 340 118 380 122 410 M280 300 C284 340 282 380 278 410"/>
<path fill="${C.camelShade}" stroke="${C.camelLine}" stroke-width="1.6" d="M122 412 C170 420 230 420 278 412 L278 428 C230 436 170 436 122 428 Z"/>
<path fill="none" stroke="${C.camelLight}" stroke-width="1.2" stroke-linecap="round" opacity="0.6" d="M128 414 Q200 421 272 414"/>
<rect x="191" y="410" width="18" height="24" rx="3" fill="none" stroke="url(#${id}-gold)" stroke-width="2.4"/>
${brush([136, 318], [142, 370], [138, 412], 0.3, 2.2, 0.3, '#7E5A2E', ' opacity="0.7"')}
${brush([264, 318], [258, 370], [262, 412], 0.3, 2, 0.3, '#7E5A2E', ' opacity="0.5"')}
${brush([148, 340], [138, 352], [142, 366], 0.3, 1.8, 0.3, '#7E5A2E', ' opacity="0.6"')}
${brush([252, 340], [262, 352], [258, 366], 0.3, 1.6, 0.3, '#7E5A2E', ' opacity="0.5"')}
<circle cx="168" cy="330" r="3.2" fill="${C.camelShade}" stroke="${C.camelLine}" stroke-width="1"/><circle cx="232" cy="330" r="3.2" fill="${C.camelShade}" stroke="${C.camelLine}" stroke-width="1"/>
${hands(id, C.camelShade, 380)}`
}

const OUTFITS: Record<CathOutfit, (id: string) => string> = {
  field: fieldOutfit,
  market: marketOutfit,
  wax: waxOutfit,
  pinny: pinnyOutfit,
  gown: gownOutfit,
}

// Pieces that sit over the neck (drawn in the head group, beneath the chin).
const NECKWEAR: Record<CathOutfit, (id: string) => string> = {
  field: () => '',
  pinny: () => '',
  gown: () => '',
  wax: (id) => {
    const roll = 'M182 232 C192 238 208 238 218 232 C224 240 226 252 222 262 C208 270 192 270 178 262 C174 252 176 240 182 232 Z'
    return `<path fill="${C.knit}" stroke="${C.knitLine}" stroke-width="1.6" stroke-linejoin="round" d="${roll}"/>
<path fill="url(#${id}-rib)" d="${roll}"/>
${band(`${id}-rollsh`, roll, 16, 0, C.knitShade, 0.8)}
<path fill="none" stroke="${C.knitShade}" stroke-width="1.4" stroke-linecap="round" d="M182 244 Q200 252 218 244"/>`
  },
  market: (id) => {
    const wrap = 'M176 232 C188 244 212 244 224 232 C236 242 236 258 228 268 C212 280 188 280 172 268 C164 258 164 242 176 232 Z'
    const tail = 'M208 266 C214 296 212 322 206 344 L224 348 C230 322 230 294 222 264 Z'
    return `<path fill="#8C7A5A" opacity="0.35" transform="translate(-3 5)" d="${wrap}"/>
<path fill="${C.knit}" stroke="${C.knitLine}" stroke-width="1.6" stroke-linejoin="round" d="${tail}"/>
<path fill="url(#${id}-rib)" d="${tail}"/>
<path fill="none" stroke="${C.knitLine}" stroke-width="1" opacity="0.6" d="M207 344 l-1 6 M211 345 l-0.5 6 M215 346 l0 6 M219 347 l0.5 6 M223 348 l1 6"/>
<path fill="${C.knit}" stroke="${C.knitLine}" stroke-width="1.6" stroke-linejoin="round" d="${wrap}"/>
<path fill="url(#${id}-rib)" d="${wrap}"/>
${band(`${id}-scsh`, wrap, 22, 0, C.knitShade, 0.85)}
<path fill="none" stroke="${C.knitShade}" stroke-width="2" stroke-linecap="round" d="M180 246 Q200 258 220 246 M178 258 Q200 270 222 258"/>
${band(`${id}-scrim`, wrap, -2.5, 1.5, C.white, 0.7)}`
  },
}

// A relaxed, graceful pose: both sleeves converge in front of her waist, so her hands rest there, lightly
// clasped. cy is the sleeve tip's y, shared with the outfit's sleeve paths so the cuffs and hands line up.
function hands(id: string, cuffShade: string, cy: number): string {
  const x = 199
  // Asymmetric on purpose: her far hand peeks out low and to the left, mostly covered by her near hand
  // resting on top, thumb wrapped over the right side (a symmetric version read as a heart, gate 8).
  const near = `M${x - 15} ${cy + 2}
C${x - 7} ${cy - 4} ${x + 7} ${cy - 4} ${x + 16} ${cy + 3}
C${x + 21} ${cy + 8} ${x + 19} ${cy + 17} ${x + 11} ${cy + 21}
C${x + 1} ${cy + 25} ${x - 10} ${cy + 23} ${x - 16} ${cy + 17}
C${x - 20} ${cy + 12} ${x - 19} ${cy + 5} ${x - 15} ${cy + 2} Z`
  return `<path fill="none" stroke="${cuffShade}" stroke-width="1.6" stroke-linecap="round" d="M186 ${cy - 6} Q200 ${cy} 214 ${cy - 6}"/>
<ellipse cx="${x - 12}" cy="${cy + 15}" rx="8" ry="11" fill="${C.skinShade}" stroke="${C.skinLine}" stroke-width="1.4" transform="rotate(20 ${x - 12} ${cy + 15})"/>
<path fill="${SKIN}" stroke="${C.skinLine}" stroke-width="1.6" stroke-linejoin="round" d="${near}"/>
${band(`${id}-hand`, near, 8, -2, C.skinShade, 0.9)}
${brush([x - 7, cy + 2], [x - 5, cy + 9], [x - 9, cy + 15], 0.3, 1.1, 0.3, C.skinDeep)}
${brush([x, cy + 1], [x + 2, cy + 9], [x - 2, cy + 17], 0.3, 1.1, 0.3, C.skinDeep)}
${brush([x + 7, cy + 2], [x + 9, cy + 10], [x + 5, cy + 18], 0.3, 1.1, 0.3, C.skinDeep)}
<ellipse cx="${x + 4}" cy="${cy + 2}" rx="5" ry="1.6" fill="${C.skinLight}" opacity="0.7"/>
<path fill="${C.skinShade}" stroke="${C.skinLine}" stroke-width="1.3" stroke-linejoin="round" d="M${x + 12} ${cy + 4} C${x + 17} ${cy + 6} ${x + 18} ${cy + 12} ${x + 13} ${cy + 15} C${x + 10} ${cy + 12} ${x + 9} ${cy + 7} ${x + 12} ${cy + 4} Z"/>`
}

function accessories(id: string, outfit: CathOutfit): string {
  // Pearl studs, and a pasture-green leaf clip in her hair (VISION: "a cute touch").
  const pearl = (cx: number) => `<circle cx="${cx + 0.8}" cy="191.4" r="4.8" fill="#000" opacity="0.25"/>
<circle cx="${cx}" cy="190" r="4.6" fill="url(#${id}-pearl)" stroke="#8C7F70" stroke-width="0.9"/>
<circle cx="${cx - 1.4}" cy="188.4" r="1.4" fill="${C.white}"/>`
  const clip = `<g transform="translate(236 92) rotate(28)">
<path fill="#000" opacity="0.3" transform="translate(-1.5 2)" d="M0 -12 C-8 -6 -8 6 0 12 C8 6 8 -6 0 -12 Z"/>
<path fill="url(#${id}-leaf)" stroke="${C.leafDeep}" stroke-width="1.2" d="M0 -12 C-8 -6 -8 6 0 12 C8 6 8 -6 0 -12 Z"/>
<path fill="none" stroke="${C.leafLight}" stroke-width="1.1" stroke-linecap="round" d="M0 -9 L0 9 M0 -2 L-3.5 -5 M0 3 L3.5 0 M0 -6 L3 -8.5"/>
<path fill="${C.white}" opacity="0.55" d="M2 -9 C5 -5 5 -1 3 2 C3.5 -2 3 -6 2 -9 Z"/>
<rect x="-1.6" y="9" width="3.2" height="5" rx="1" fill="url(#${id}-gold)"/>
</g>`
  const ribbon =
    outfit === 'market'
      ? `<g transform="translate(166 90) rotate(-24)"><path fill="#C9566B" stroke="#7A2A3A" stroke-width="1.2" d="M0 0 L-12 -7 L-12 7 Z M0 0 L12 -7 L12 7 Z"/><path fill="#A63F55" d="M0 0 L-12 3 L-12 7 Z M0 0 L12 3 L12 7 Z"/><path fill="none" stroke="#F4D9DE" stroke-width="0.8" stroke-dasharray="1.6 1.6" d="M-10 -4 L-10 4 M10 -4 L10 4"/><circle r="3" fill="#A63F55" stroke="#7A2A3A" stroke-width="1"/></g>`
      : ''
  return pearl(147) + pearl(253) + clip + ribbon
}
