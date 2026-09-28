// Cath, the face of every game on cathnivore.com (VISION.md "Cath: character bible"): a classy, cute,
// stylish mum. One framework-free renderer so the Cathnivore app (React), Runnel and the landing page all
// draw the same Cath. It returns SVG markup as a string. There are no inline style attributes (the site's
// CSP forbids them) and every gradient id is unique per call, so several Caths can share a page.
//
// Animation hooks (shared/cath/cath.css): .cath-lids (blink; hidden by default with opacity="0", so the
// art is right even without the CSS), .cath-hair-front (sway), .cath-body (breathing), .cath-head (tilt).

export type CathExpression = 'smirk' | 'delighted' | 'determined' | 'worried' | 'wink'
export type CathOutfit = 'field' | 'market'
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
  hairShine: '#6B4E42',
  hairDeep: '#1E1512',
  skinShade: '#EDC3AE',
  skinDeep: '#E2AE97',
  blush: '#F29A93',
  lip: '#C9566B',
  lipDeep: '#A63F55',
  lipShine: '#F6C3CC',
  iris: '#5A3A28',
  irisLight: '#8A5E42',
  white: '#FFFFFF',
  eyeWhite: '#FFFDFB',
  liner: '#221613',
  brow: '#2A1D18',
  olive: '#6E7C4B',
  oliveShade: '#56623A',
  oliveLight: '#86955F',
  blouse: '#F7F0E3',
  blouseShade: '#E4D8C2',
  pearl: '#FBF7F0',
  pearlShade: '#DCD3C6',
  gold: '#D4AE58',
  leaf: '#5B7F3A',
  leafLight: '#86AC5B',
  camel: '#C99A61',
  camelShade: '#AA7D48',
  camelLight: '#DDB47F',
  knit: '#F1E6D0',
  knitShade: '#DCCDB0',
  teeth: '#FFFDF8',
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
<g class="cath-body">${outfit === 'market' ? marketOutfit(id) : fieldOutfit(id)}</g>
<g class="cath-head">
${neckAndFace(id)}
${features(expression)}
${hairFront(id)}
${accessories(outfit)}
</g>
</svg>`
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function defs(id: string): string {
  return `<defs>
<linearGradient id="${id}-hair" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${HAIR}"/><stop offset="0.55" stop-color="${HAIR}"/><stop offset="1" stop-color="${C.hairDeep}"/>
</linearGradient>
<radialGradient id="${id}-shine" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="${C.hairShine}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.hairShine}" stop-opacity="0"/>
</radialGradient>
<radialGradient id="${id}-face" cx="0.5" cy="0.42" r="0.62">
  <stop offset="0.6" stop-color="${SKIN}"/><stop offset="1" stop-color="${C.skinShade}"/>
</radialGradient>
<linearGradient id="${id}-olive" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.oliveLight}"/><stop offset="0.45" stop-color="${C.olive}"/><stop offset="1" stop-color="${C.oliveShade}"/>
</linearGradient>
<linearGradient id="${id}-camel" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${C.camelLight}"/><stop offset="0.45" stop-color="${C.camel}"/><stop offset="1" stop-color="${C.camelShade}"/>
</linearGradient>
<linearGradient id="${id}-blouse" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${C.blouse}"/><stop offset="1" stop-color="${C.blouseShade}"/>
</linearGradient>
<radialGradient id="${id}-pearl" cx="0.35" cy="0.3" r="0.7">
  <stop offset="0" stop-color="${C.white}"/><stop offset="0.6" stop-color="${C.pearl}"/><stop offset="1" stop-color="${C.pearlShade}"/>
</radialGradient>
</defs>`
}

// ---- hair ------------------------------------------------------------------------------------------------

function hairBack(id: string): string {
  // Hair behind her: it hugs the head, then falls behind the shoulders in soft waves. Most of its length is
  // carried by the two front locks, so her shoulders stay visible.
  return `<path fill="url(#${id}-hair)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="
M200 60
C154 58 126 90 124 144
C122 186 118 222 122 252
C126 278 120 296 128 314
L272 314
C280 296 274 278 278 252
C282 222 278 186 276 144
C274 90 246 58 200 60 Z"/>`
}

function hairFront(id: string): string {
  // A centre part, soft curtain bangs sweeping off the forehead, and two long waved locks falling over the
  // front of the shoulders to the waist.
  const lock = (f: 1 | -1) => {
    const x = (v: number) => (200 + (v - 200) * f).toFixed(1)
    return `<path fill="url(#${id}-hair)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="
M${x(200)} 66
C${x(182)} 66 ${x(162)} 74 ${x(150)} 90
C${x(138)} 108 ${x(134)} 132 ${x(135)} 156
C${x(136)} 180 ${x(132)} 200 ${x(130)} 222
C${x(126)} 250 ${x(146)} 268 ${x(144)} 296
C${x(142)} 322 ${x(158)} 340 ${x(152)} 368
C${x(148)} 390 ${x(160)} 408 ${x(154)} 430
C${x(170)} 420 ${x(176)} 402 ${x(172)} 382
C${x(168)} 360 ${x(178)} 340 ${x(170)} 314
C${x(162)} 290 ${x(168)} 270 ${x(158)} 244
C${x(152)} 226 ${x(152)} 196 ${x(152)} 172
C${x(152)} 150 ${x(154)} 132 ${x(162)} 118
C${x(172)} 124 ${x(186)} 118 ${x(194)} 104
C${x(198)} 96 ${x(200)} 88 ${x(200)} 80 Z"/>
<path fill="none" stroke="${C.hairShine}" stroke-width="2.2" stroke-linecap="round" opacity="0.6" d="M${x(158)} 94 C${x(148)} 108 ${x(142)} 128 ${x(142)} 150 M${x(146)} 280 C${x(152)} 300 ${x(152)} 318 ${x(160)} 338 M${x(160)} 372 C${x(164)} 388 ${x(162)} 400 ${x(160)} 412"/>`
  }
  return `<g class="cath-hair-front">
${lock(1)}
${lock(-1)}
<path fill="url(#${id}-hair)" d="M200 60 C174 60 156 70 148 86 C164 76 184 72 200 72 C216 72 236 76 252 86 C244 70 226 60 200 60 Z"/>
<ellipse cx="200" cy="75" rx="38" ry="8" fill="url(#${id}-shine)"/>
<path fill="none" stroke="${C.hairDeep}" stroke-width="1.6" stroke-linecap="round" d="M200 64 L200 82"/>
</g>`
}

// ---- face ------------------------------------------------------------------------------------------------

function neckAndFace(id: string): string {
  return `<path fill="${SKIN}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="M184 206 C185 228 184 242 180 256 L220 256 C216 242 215 228 216 206 Z"/>
<path fill="${C.skinDeep}" opacity="0.5" d="M184 212 C194 226 206 226 216 212 L216 226 C206 234 194 234 184 226 Z"/>
<path fill="url(#${id}-face)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="
M200 226
C178 226 156 210 148 182
C142 160 141 128 150 104
C160 80 180 70 200 70
C220 70 240 80 250 104
C259 128 258 160 252 182
C244 210 222 226 200 226 Z"/>`
}

function eye(cx: number, flip: 1 | -1, variant: 'open' | 'closed-happy' | 'closed-wink' | 'narrow'): string {
  // flip = -1 for her right eye (viewer's left) so the liner wing and lashes point outwards.
  const x = (dx: number) => (cx + dx * flip).toFixed(1)
  const y0 = 153
  if (variant === 'closed-happy' || variant === 'closed-wink') {
    const lift = variant === 'closed-happy' ? -6 : -4
    return `<path fill="none" stroke="${C.liner}" stroke-width="3.4" stroke-linecap="round" d="M${x(-13)} ${y0} Q${x(0)} ${y0 + lift} ${x(13)} ${y0}"/>
<path fill="none" stroke="${C.liner}" stroke-width="2" stroke-linecap="round" d="M${x(13)} ${y0} L${x(18)} ${y0 - 4.5} M${x(9)} ${y0 - 2.5} L${x(12.5)} ${y0 - 7}"/>`
  }
  const top = variant === 'narrow' ? y0 - 4 : y0 - 11
  return `<g class="cath-eye">
<path fill="${C.eyeWhite}" d="M${x(-13.5)} ${y0} Q${x(-1)} ${top} ${x(14)} ${y0 - 1} Q${x(1)} ${y0 + 10} ${x(-13.5)} ${y0} Z"/>
<circle cx="${x(1)}" cy="${y0 + 0.5}" r="8.6" fill="${C.iris}"/>
<circle cx="${x(1)}" cy="${y0 + 2.5}" r="5.6" fill="${C.irisLight}" opacity="0.6"/>
<circle cx="${x(1)}" cy="${y0 + 0.5}" r="4.2" fill="${C.liner}"/>
<circle cx="${x(-2.2)}" cy="${y0 - 3}" r="2.8" fill="${C.white}"/>
<circle cx="${x(4.2)}" cy="${y0 + 3.4}" r="1.3" fill="${C.white}"/>
<path fill="none" stroke="${C.liner}" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round" d="M${x(-14.5)} ${y0 - 0.5} Q${x(-1)} ${top - 2.5} ${x(14.5)} ${y0 - 1.5} L${x(20)} ${y0 - 6.5}"/>
<path fill="none" stroke="${C.liner}" stroke-width="1.8" stroke-linecap="round" d="M${x(9)} ${y0 - 7.5} L${x(12)} ${y0 - 11.5} M${x(13.5)} ${y0 - 4} L${x(17)} ${y0 - 7.5}"/>
<path fill="none" stroke="${C.ink}" stroke-width="1" stroke-linecap="round" opacity="0.45" d="M${x(-10)} ${y0 + 6} Q${x(1)} ${y0 + 10} ${x(11)} ${y0 + 5}"/>
<path class="cath-lids" opacity="0" fill="${C.skinShade}" stroke="${C.liner}" stroke-width="2.4" d="M${x(-15)} ${y0} Q${x(-1)} ${top - 3} ${x(15)} ${y0 - 1} Q${x(1)} ${y0 + 10.5} ${x(-15)} ${y0} Z"/>
</g>`
}

function brows(expression: CathExpression): string {
  // Left then right (viewer's left = her right). Her viewer-right brow sits a touch higher by default.
  // Determined and worried push their control points further from smirk's baseline than the others
  // (a squint-furrow vs. a raised, pulled-apart worry) — flagged by a gate-8 review as too close to tell
  // apart at 56-96px; wider deltas keep them readable at companion/portrait scale, not just at full size.
  const shapes: Record<CathExpression, [string, string]> = {
    smirk: ['M159 131 Q172 124 186 129', 'M214 127 Q228 118 242 124'],
    wink: ['M159 133 Q172 127 186 131', 'M214 125 Q228 116 242 122'],
    delighted: ['M159 128 Q172 120 186 125', 'M214 125 Q228 120 241 128'],
    determined: ['M159 124 Q173 130 187 140', 'M213 140 Q227 130 241 124'],
    worried: ['M160 138 Q172 130 186 120', 'M214 120 Q228 130 240 138'],
  }
  const [l, r] = shapes[expression]
  return `<path fill="none" stroke="${C.brow}" stroke-width="3.4" stroke-linecap="round" d="${l}"/>
<path fill="none" stroke="${C.brow}" stroke-width="3.4" stroke-linecap="round" d="${r}"/>`
}

function mouth(expression: CathExpression): string {
  switch (expression) {
    case 'delighted':
      return `<path fill="${C.lipDeep}" stroke="${C.ink}" stroke-width="1.6" stroke-linejoin="round" d="M184 192 Q200 196 216 192 Q212 210 200 210 Q188 210 184 192 Z"/>
<path fill="${C.teeth}" d="M187 193.5 Q200 197 213 193.5 Q212 199 200 199.5 Q188 199 187 193.5 Z"/>
<path fill="${C.lip}" d="M191 205 Q200 211 209 205 Q205 209.5 200 209.8 Q195 209.5 191 205 Z"/>`
    case 'worried':
      // A deeper frown than before, so it reads at a glance rather than blending into determined's flat line.
      return `<path fill="${C.lip}" stroke="${C.ink}" stroke-width="1.4" d="M190 200 Q200 191 210 200 Q200 204.5 190 200 Z"/>
<ellipse cx="199" cy="200.2" rx="2.6" ry="0.9" fill="${C.lipShine}"/>`
    case 'determined':
      // A flatter, firmer press than the default smirk line — reads as set-jaw resolve rather than ease.
      return `<path fill="${C.lip}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round" d="M186 197.5 Q193 195 200 196 Q207 195 214 197.5 Q207 200 200 200 Q193 200 186 197.5 Z"/>
<ellipse cx="202" cy="199" rx="3.4" ry="0.9" fill="${C.lipShine}"/>`
    default:
      // A warm smirk: the viewer-right corner lifts.
      return `<path fill="${C.lip}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round" d="M187 197 Q194 192.5 200 195 Q207 191.5 215.5 192.5 Q209 203 200 202.5 Q192 202.5 187 197 Z"/>
<path fill="none" stroke="${C.lipDeep}" stroke-width="1.2" stroke-linecap="round" d="M188 197 Q200 199 215 193"/>
<ellipse cx="203" cy="200" rx="4" ry="1.2" fill="${C.lipShine}"/>
<path fill="none" stroke="${C.skinDeep}" stroke-width="1.3" stroke-linecap="round" d="M216 191 Q219 192 218.5 195"/>`
  }
}

function features(expression: CathExpression): string {
  const leftEye = expression === 'delighted' ? 'closed-happy' : expression === 'determined' ? 'narrow' : 'open'
  const rightEye =
    expression === 'delighted' ? 'closed-happy' : expression === 'wink' ? 'closed-wink' : expression === 'determined' ? 'narrow' : 'open'
  const blushOpacity = expression === 'delighted' || expression === 'wink' ? 0.42 : 0.26
  return `<g class="cath-features">
<ellipse cx="163" cy="180" rx="12" ry="6" fill="${C.blush}" opacity="${blushOpacity}"/>
<ellipse cx="237" cy="180" rx="12" ry="6" fill="${C.blush}" opacity="${blushOpacity}"/>
${eye(171, -1, leftEye)}
${eye(229, 1, rightEye)}
${brows(expression)}
<path fill="none" stroke="${C.skinDeep}" stroke-width="1.8" stroke-linecap="round" d="M199 164 Q196.5 176 200 180 Q203 181 205 179"/>
<ellipse cx="201.5" cy="172" rx="1.4" ry="3" fill="${C.white}" opacity="0.5"/>
${mouth(expression)}
</g>`
}

// ---- outfits and accessories -------------------------------------------------------------------------------

function fieldOutfit(id: string): string {
  // A tailored olive blazer (sloped shoulders, nipped waist, notched lapels, one button) over a cream silk
  // blouse, with a fine gold chain and a small leaf pendant.
  return `<path fill="url(#${id}-blouse)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="M182 250 C194 256 206 256 218 250 L222 420 L178 420 Z"/>
<path fill="${SKIN}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" d="M181 250 C192 256 208 256 219 250 L200 300 Z"/>
<path fill="none" stroke="${C.gold}" stroke-width="1.3" d="M183 254 Q200 282 217 254"/>
<path fill="${C.leaf}" stroke="${C.ink}" stroke-width="0.9" d="M200 274 C195 279 196 286 200 289 C204 286 205 279 200 274 Z"/>
<path fill="url(#${id}-olive)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="
${JACKET}"/>
<path fill="none" stroke="${C.oliveShade}" stroke-width="2" stroke-linecap="round" d="M136 318 C142 360 142 420 134 500 M264 318 C258 360 258 420 266 500"/>
<path fill="none" stroke="${C.oliveShade}" stroke-width="1.6" stroke-linecap="round" d="M176 424 C172 446 174 472 178 500 M224 424 C228 446 226 472 222 500"/>
<path fill="${C.oliveLight}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" d="M183 250 L160 268 L168 282 L158 290 L200 404 Z"/>
<path fill="${C.oliveLight}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" d="M217 250 L240 268 L232 282 L242 290 L200 404 Z"/>
<circle cx="200" cy="418" r="4.4" fill="${C.oliveShade}" stroke="${C.ink}" stroke-width="1.3"/>`
}

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

function marketOutfit(id: string): string {
  // A camel trench with wide lapels and a belted waist, and a cream knit scarf wrapped high.
  return `<path fill="url(#${id}-blouse)" stroke="${C.ink}" stroke-width="2" d="M182 254 L218 254 L222 420 L178 420 Z"/>
<path fill="url(#${id}-camel)" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="
${JACKET.replace('L200 404', 'L200 380')}"/>
<path fill="${C.camelLight}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" d="M183 250 L150 276 L162 292 L148 304 L200 380 Z"/>
<path fill="${C.camelLight}" stroke="${C.ink}" stroke-width="1.8" stroke-linejoin="round" d="M217 250 L250 276 L238 292 L252 304 L200 380 Z"/>
<path fill="${C.camelShade}" stroke="${C.ink}" stroke-width="1.6" d="M122 412 C170 420 230 420 278 412 L278 428 C230 436 170 436 122 428 Z"/>
<rect x="191" y="410" width="18" height="24" rx="3" fill="none" stroke="${C.gold}" stroke-width="2.4"/>
<path fill="none" stroke="${C.camelShade}" stroke-width="2" stroke-linecap="round" d="M136 318 C142 360 142 390 138 412 M264 318 C258 360 258 390 262 412"/>
<path fill="${C.knit}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="M176 232 C188 244 212 244 224 232 C236 242 236 258 228 268 C212 280 188 280 172 268 C164 258 164 242 176 232 Z"/>
<path fill="${C.knit}" stroke="${C.ink}" stroke-width="2" stroke-linejoin="round" d="M208 266 C214 296 212 322 206 344 L224 348 C230 322 230 294 222 264 Z"/>
<path fill="none" stroke="${C.knitShade}" stroke-width="2" stroke-linecap="round" d="M180 246 Q200 258 220 246 M178 258 Q200 270 222 258 M212 288 L224 286 M210 310 L224 308 M209 332 L223 332"/>`
}

function accessories(outfit: CathOutfit): string {
  // Pearl studs, and a pasture-green leaf clip in her hair (VISION: "a cute touch").
  const pearls = `<circle cx="147" cy="190" r="4.6" fill="${C.pearl}" stroke="${C.ink}" stroke-width="1.2"/>
<circle cx="145.8" cy="188.6" r="1.4" fill="${C.white}"/>
<circle cx="253" cy="190" r="4.6" fill="${C.pearl}" stroke="${C.ink}" stroke-width="1.2"/>
<circle cx="251.8" cy="188.6" r="1.4" fill="${C.white}"/>`
  const clip = `<g transform="translate(236 92) rotate(28)">
<path fill="${C.leaf}" stroke="${C.ink}" stroke-width="1.4" d="M0 -12 C-8 -6 -8 6 0 12 C8 6 8 -6 0 -12 Z"/>
<path fill="none" stroke="${C.leafLight}" stroke-width="1.2" d="M0 -9 L0 9 M0 -2 L-3.5 -5 M0 3 L3.5 0"/>
</g>`
  const ribbon =
    outfit === 'market'
      ? `<g transform="translate(166 90) rotate(-24)"><path fill="#C9566B" stroke="${C.ink}" stroke-width="1.3" d="M0 0 L-12 -7 L-12 7 Z M0 0 L12 -7 L12 7 Z"/><circle r="3" fill="#A63F55" stroke="${C.ink}" stroke-width="1"/></g>`
      : ''
  return pearls + clip + ribbon
}
