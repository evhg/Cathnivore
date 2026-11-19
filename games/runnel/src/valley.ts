// Plan item 77: the valley the board sits in, painted down the whole frame and lit by the day. `sceneLight` turns
// a board's time and weather into a palette (pure, unit-tested); `valleyLayers` draws a patchwork of fields and
// hedgerows under a soft horizon, seeded per board, in the stage's own 0-1000 box (the SVG stretches to fit).
// The fills are CSS custom properties, so dark mode can mix the palette into the night paper.

import { hashString } from './engine'
import type { Sky, TimeOfDay } from './sky'
import type { Season } from './season'

export interface SceneLight {
  skyTop: string
  skyLow: string
  far: string
  near: string
  meadow: string
  meadowLow: string
  crop: string
  wheat: string
  fallow: string
  hedge: string
  /** Plan item 508: the poster crops (rapeseed or autumn mustard, lavender or phacelia, kale, the plough's umber). */
  rapeseed: string
  lavender: string
  kale: string
  plough: string
}

const BASE: Record<TimeOfDay, Omit<SceneLight, PosterCrop>> = {
  // A cool, pale morning: dew on the grass, the sky still cream at the horizon.
  morning: {
    skyTop: '#c4e2f4', skyLow: '#fbeccf', far: '#b7c99f', near: '#9fba7c', meadow: '#c3d696', meadowLow: '#adc580',
    crop: '#a9c46e', wheat: '#e6d49a', fallow: '#d4b98e', hedge: '#678a47',
  },
  // Midday: high, clear blue and full greens.
  noon: {
    skyTop: '#8ccbf0', skyLow: '#e3f2f6', far: '#a6c486', near: '#88b262', meadow: '#b6d47f', meadowLow: '#9dc26a',
    crop: '#93bd55', wheat: '#ecd585', fallow: '#d8b783', hedge: '#557f36',
  },
  // Golden hour: warm, long light, everything a shade of honey.
  golden: {
    skyTop: '#f3b56c', skyLow: '#fde3ad', far: '#c8b676', near: '#b0a85e', meadow: '#d8cc86', meadowLow: '#c4b56b',
    crop: '#b4b052', wheat: '#f0c870', fallow: '#d9a874', hedge: '#6f7434',
  },
  // Dusk: violet sky over a peach horizon, the fields gone dim and blue-grey.
  // Plan item 229: still a picture at dusk: the greens and the wheat keep their colour under the violet.
  dusk: {
    skyTop: '#62558a', skyLow: '#f0a98a', far: '#8a789e', near: '#77866a', meadow: '#9aa07e', meadowLow: '#848b6a',
    crop: '#7f9858', wheat: '#cfa876', fallow: '#b2896e', hedge: '#566448',
  },
}

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number]
const toHex = (rgb: number[]): string =>
  '#' + rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')

/** Pulls a colour toward its own grey by `amount` (0..1) and darkens it by `dim` (0..1): rain and cloud. */
function overcast(c: string, amount: number, dim: number): string {
  const [r, g, b] = hex(c)
  const grey = 0.3 * r + 0.59 * g + 0.11 * b
  return toHex([r, g, b].map((v) => (v + (grey - v) * amount) * (1 - dim)))
}

type PosterCrop = 'rapeseed' | 'lavender' | 'kale' | 'plough'
/** Plan item 508: a farmers'-market poster's crop colours at midday, each pulled toward the hour's own fallow light. */
const POSTER: Record<PosterCrop, string> = { rapeseed: '#e3c233', lavender: '#a08cbf', kale: '#4e8270', plough: '#8c5b3a' }
const POSTER_LIGHT: Record<TimeOfDay, number> = { morning: 0.12, noon: 0, golden: 0.22, dusk: 0.38 }
function mixHex(a: string, b: string, t: number): string {
  const x = hex(a), y = hex(b)
  return toHex(x.map((v, i) => v + (y[i]! - v) * t))
}

export function sceneLight(sky: Pick<Sky, 'time' | 'weather'>): SceneLight {
  const hour = BASE[sky.time]
  const base: SceneLight = { ...hour } as SceneLight
  for (const k of Object.keys(POSTER) as PosterCrop[]) base[k] = mixHex(POSTER[k], hour.fallow, POSTER_LIGHT[sky.time])
  if (sky.weather === 'clear' || sky.weather === 'breeze') return { ...base }
  // Plan item 229: rain softens the colour, it doesn't take it away (0.5 grey and 10% dark turned the valley to slate).
  // Plan item 298: a *light* drizzle with sunbreaks: the land keeps most of the hour's colour (0.3 grey read as a wash
  // over golden hour) and the sky keeps its hour's tint low down, where the sun breaks through.
  const [amount, dim] = sky.weather === 'drizzle' ? [0.18, 0.03] : [0.15, 0.02]
  const out = {} as SceneLight
  for (const k of Object.keys(base) as (keyof SceneLight)[]) out[k] = overcast(base[k], amount, dim)
  if (sky.weather === 'drizzle') {
    const warm = sky.time === 'golden' || sky.time === 'morning'
    out.skyTop = overcast(base.skyTop, warm ? 0.45 : 0.6, 0.08)
    out.skyLow = overcast(base.skyLow, warm ? 0.2 : 0.4, 0.02)
  }
  return out
}

/** Relative luminance (WCAG) of a #rrggbb colour. */
export function luminance(c: string): number {
  const [r, g, b] = hex(c).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Hue in degrees and saturation (HSL, 0..1) of a #rrggbb colour. */
export function hueSat(c: string): { hue: number; sat: number } {
  const [r, g, b] = hex(c).map((v) => v / 255) as [number, number, number]
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let hue = 0
  if (d) hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { hue: (hue * 60 + 360) % 360, sat }
}

/** OKLCH lightness (0..1) and chroma of a #rrggbb colour (plan item 229: the valley's colour floor). */
export function oklch(c: string): { L: number; C: number } {
  const [r, g, b] = hex(c).map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s2 = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s2
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s2
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s2
  return { L, C: Math.hypot(A, B) }
}

/** The palette as the CSS custom properties the valley's classes read. */
export function lightVars(light: SceneLight): Record<string, string> {
  return {
    '--vl-sky-top': light.skyTop, '--vl-sky-low': light.skyLow, '--vl-far': light.far, '--vl-near': light.near,
    '--vl-meadow': light.meadow, '--vl-meadow-low': light.meadowLow, '--vl-crop': light.crop,
    '--vl-wheat': light.wheat, '--vl-fallow': light.fallow, '--vl-hedge': light.hedge,
    '--vl-rapeseed': light.rapeseed, '--vl-lavender': light.lavender, '--vl-kale': light.kale, '--vl-plough': light.plough,
  }
}

/**
 * Plan item 508: the fields the valley grows, by season, so the patchwork reads as a poster of a farming year (it was
 * one khaki wash of crop, wheat, grass and fallow): spring's rapeseed and kale, summer's wheat and lavender, autumn's
 * plough, stubble and its cover crops (mustard and phacelia), winter's plough and kale.
 */
const KINDS: Record<Season, readonly string[]> = {
  spring: ['rapeseed', 'crop', 'grass', 'kale', 'plough', 'rapeseed', 'grass', 'crop'],
  summer: ['wheat', 'lavender', 'crop', 'grass', 'wheat', 'rapeseed', 'fallow', 'grass'],
  autumn: ['plough', 'wheat', 'kale', 'grass', 'mustard', 'phacelia', 'plough', 'grass'],
  winter: ['plough', 'kale', 'grass', 'fallow', 'plough', 'grass', 'kale'],
}
/** Kinds drawn without furrows (grass and the flowering crops read as a flat sheet of colour). */
const FLAT = new Set(['grass', 'rapeseed', 'mustard', 'lavender', 'phacelia'])

/**
 * The valley's painted layers (sky, far and near hills melting into the meadow, a patchwork of fields with furrows,
 * hedgerows along their edges, a few trees, Cath's footpath down to Bea's garden), seeded by the board.
 * Rows grow taller toward the foot, as fields do when the ground comes nearer.
 */
export function valleyLayers(seed: string, weather: Sky['weather'], season: Season = 'summer'): string {
  const kinds = KINDS[season]
  const rnd = (k: number) => (hashString(`${seed}:valley:${k}`) % 10000) / 10000
  // Plan item 389: the valley seen from the board's own top-down angle: rows of even depth under a thin horizon band
  // (the ground from 118 of 1000), not a perspective that grew from 80 to 210 toward the foot.
  const rows = [118, 296, 474, 652, 830, 1010]
  const parts: string[] = []
  const hedges: string[] = []
  const trees: string[] = []
  const puddles: string[] = []
  const slope = (row: number, x: number) => rows[row]! + (rnd(row) - 0.5) * 40 * (x / 1000 - 0.5)
  let n = 0
  let prevKind = ''
  for (let r = 0; r < rows.length - 1; r++) {
    // Cut the row into 3-5 fields with seeded widths and slanted dividers.
    const count = 3 + Math.floor(rnd(100 + r) * 3)
    const cuts = [-40]
    for (let i = 1; i < count; i++) cuts.push(((i + (rnd(200 + r * 10 + i) - 0.5) * 0.6) / count) * 1000)
    cuts.push(1040)
    const lean = (rnd(300 + r) - 0.5) * 80 * (r + 1) / 3
    // Atmospheric depth: the far rows fade into the hills, so the horizon is soft.
    parts.push(`<g opacity="${[0.82, 0.9, 0.95, 1, 1][r]}">`)
    for (let i = 0; i < count; i++) {
      const xa = cuts[i]!, xb = cuts[i + 1]!
      // Neighbours differ: a field never repeats the one to its left.
      let kind = kinds[Math.floor(rnd(400 + n) * kinds.length)]!
      if (i > 0 && kind === prevKind) kind = kinds[(kinds.indexOf(kind) + 1 + Math.floor(rnd(410 + n) * (kinds.length - 1))) % kinds.length]!
      prevKind = kind
      const pts = [
        [xa, slope(r, xa)], [xb, slope(r, xb)], [xb + lean, slope(r + 1, xb + lean)], [xa + lean, slope(r + 1, xa + lean)],
      ].map(([x, y]) => `${x!.toFixed(0)},${y!.toFixed(0)}`).join(' ')
      // Plan item 308: each field's place in the wave that greens the valley on a solve (far rows first, then left to
      // right), as a delay bucket 0-9 (styles.css).
      const wave = Math.min(9, r * 2 + Math.floor((i * 2) / count))
      parts.push(`<polygon class="vl-f vl-f-${kind} vl-w${wave}" points="${pts}"/>`)
      if (!FLAT.has(kind)) {
        const pat = rnd(500 + n) < 0.5 ? 'vl-rows-h' : rnd(600 + n) < 0.5 ? 'vl-rows-d' : 'vl-rows-a'
        parts.push(`<polygon class="vl-furrow" fill="url(#${pat})" points="${pts}"/>`)
      }
      // Plan item 229: on a rain day a field nearer the foot holds a puddle that catches the sky, with a glint.
      if (weather === 'drizzle' && r >= 2 && rnd(800 + n) < 0.5) {
        const px = (xa + xb) / 2 + lean * 0.5 + (rnd(810 + n) - 0.5) * (xb - xa) * 0.4
        const py = (slope(r, xa) + slope(r + 1, xa + lean)) / 2 + (rnd(820 + n) - 0.5) * 20
        const pw = 22 + r * 9 + rnd(830 + n) * 14
        // Plan item 273: an irregular pool (eight seeded lobes, not an ellipse), its glint a curve along the far rim
        // and a raindrop's ring on it; an ellipse with a straight dash across read as a 'minus' button.
        const ry = pw * 0.32
        const rim = Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2
          const f = 0.78 + rnd(840 + n * 8 + k) * 0.4
          return [px + Math.cos(a) * pw * f, py + Math.sin(a) * ry * f] as const
        })
        const mid = (a: readonly [number, number], b: readonly [number, number]) => `${((a[0] + b[0]) / 2).toFixed(1)} ${((a[1] + b[1]) / 2).toFixed(1)}`
        let blob = `M${mid(rim[7]!, rim[0]!)}`
        for (let k = 0; k < 8; k++) blob += `Q${rim[k]![0].toFixed(1)} ${rim[k]![1].toFixed(1)} ${mid(rim[k]!, rim[(k + 1) % 8]!)}`
        const gx = px - pw * (0.15 + rnd(850 + n) * 0.3)
        const glint = `M${(gx - pw * 0.28).toFixed(1)} ${(py - ry * 0.45).toFixed(1)}Q${gx.toFixed(1)} ${(py - ry * 0.78).toFixed(1)} ${(gx + pw * 0.3).toFixed(1)} ${(py - ry * 0.5).toFixed(1)}`
        const rx = px + pw * (rnd(860 + n) * 0.5 - 0.1)
        puddles.push(`<g class="vl-puddle"><path class="vl-puddle-pool" d="${blob}Z"/><path class="vl-puddle-glint" d="${glint}"/><ellipse class="vl-puddle-ring" cx="${rx.toFixed(1)}" cy="${(py + ry * 0.15).toFixed(1)}" rx="${(pw * 0.14).toFixed(1)}" ry="${(ry * 0.22).toFixed(1)}"/></g>`)
      }
      // Plan item 508: a grass field may be an orchard: rows of small round trees in its middle, so a margin that
      // shows only grass still reads as farmed land.
      if (kind === 'grass' && r >= 1 && rnd(900 + n) < 0.5) {
        const cx = (xa + xb) / 2 + lean * 0.5, top = slope(r, cx) + 26, bot = slope(r + 1, cx + lean * 0.5) - 22
        const w = Math.min(150, (xb - xa) * 0.6)
        for (let oy = top; oy <= bot; oy += 34)
          for (let ox = cx - w / 2; ox <= cx + w / 2; ox += 30) {
            const tx = ox + ((oy - top) / Math.max(1, bot - top)) * lean * 0.5
            trees.push(`<g class="vl-tree vl-orchard"><ellipse class="vl-tree-shade" cx="${(tx + 5).toFixed(0)}" cy="${(oy + 8).toFixed(0)}" rx="9" ry="3"/><circle cx="${tx.toFixed(0)}" cy="${oy.toFixed(0)}" r="8"/><circle class="vl-tree-lit" cx="${(tx - 2.5).toFixed(0)}" cy="${(oy - 2.5).toFixed(0)}" r="3.5"/></g>`)
          }
      }
      if (i > 0) hedges.push(`M${xa.toFixed(0)} ${slope(r, xa).toFixed(0)}L${(xa + lean).toFixed(0)} ${slope(r + 1, xa + lean).toFixed(0)}`)
      // An oak or two where the hedges meet.
      if (i > 0 && rnd(700 + n) < 0.55) {
        const tx = xa + lean * 0.5, ty = (slope(r, xa) + slope(r + 1, xa + lean)) / 2
        const s = 0.9
        trees.push(`<g class="vl-tree"><ellipse class="vl-tree-shade" cx="${(tx + 10 * s).toFixed(0)}" cy="${(ty + 14 * s).toFixed(0)}" rx="${(18 * s).toFixed(0)}" ry="${(6 * s).toFixed(0)}"/><ellipse cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" rx="${(16 * s).toFixed(0)}" ry="${(15 * s).toFixed(0)}"/><ellipse class="vl-tree-lit" cx="${(tx - 5 * s).toFixed(0)}" cy="${(ty - 5 * s).toFixed(0)}" rx="${(8 * s).toFixed(0)}" ry="${(7 * s).toFixed(0)}"/></g>`)
      }
      n++
    }
    parts.push('</g>')
    if (r > 0) hedges.push(`M-20 ${slope(r, -20).toFixed(0)}L1020 ${slope(r, 1020).toFixed(0)}`)
    // Plan item 508: hedgerow oaks along the row's hedge, crowned, so the long hedges aren't bare lines.
    if (r > 0)
      for (let x = 40 + rnd(950 + r) * 90; x < 1000; x += 110 + rnd(960 + r * 7 + x) * 90) {
        if (rnd(970 + r * 13 + Math.round(x)) < 0.4) continue
        const ty = slope(r, x) - 6, s2 = 0.75 + rnd(980 + Math.round(x)) * 0.35
        trees.push(`<g class="vl-tree"><ellipse class="vl-tree-shade" cx="${(x + 9 * s2).toFixed(0)}" cy="${(ty + 13 * s2).toFixed(0)}" rx="${(16 * s2).toFixed(0)}" ry="${(5 * s2).toFixed(0)}"/><ellipse cx="${x.toFixed(0)}" cy="${ty.toFixed(0)}" rx="${(15 * s2).toFixed(0)}" ry="${(14 * s2).toFixed(0)}"/><ellipse class="vl-tree-lit" cx="${(x - 5 * s2).toFixed(0)}" cy="${(ty - 5 * s2).toFixed(0)}" rx="${(7 * s2).toFixed(0)}" ry="${(6 * s2).toFixed(0)}"/></g>`)
      }
  }
  const rain =
    weather === 'drizzle' ? '<rect class="vl-rain" x="0" y="0" width="1000" height="1000" fill="url(#vl-rain)" mask="url(#vl-rain-mask)"/>' : ''
  return (
    '<defs>' +
    '<linearGradient id="vl-sky" x1="0" y1="0" x2="0" y2="1"><stop class="vl-sky-top" offset="0"/><stop class="vl-sky-low" offset="1"/></linearGradient>' +
    '<linearGradient id="vl-ground" x1="0" y1="0" x2="0" y2="1"><stop class="vl-g-near" offset="0"/><stop class="vl-g-meadow" offset=".12"/><stop class="vl-g-low" offset="1"/></linearGradient>' +
    '<pattern id="vl-rows-h" width="24" height="12" patternUnits="userSpaceOnUse"><path class="vl-row" d="M0 6h24"/></pattern>' +
    '<pattern id="vl-rows-d" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path class="vl-row" d="M0 9h18"/></pattern>' +
    '<pattern id="vl-rows-a" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path class="vl-row" d="M0 9h18"/></pattern>' +
    // Plan item 298: a light drizzle: half the drops of before, and a sunbreak where the rain thins out (the mask).
    '<pattern id="vl-rain" width="56" height="84" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><path class="vl-drop" d="M10 6v12M38 48v12"/></pattern>' +
    '<linearGradient id="vl-break" x1="0" y1="0" x2="1" y2="0.35"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".9"/><stop offset=".62" stop-color="#fff" stop-opacity=".25"/><stop offset=".8" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff"/></linearGradient>' +
    '<mask id="vl-rain-mask"><rect x="0" y="0" width="1000" height="1000" fill="url(#vl-break)"/></mask>' +
    '</defs>' +
    '<rect class="vl-sky" width="1000" height="140" fill="url(#vl-sky)"/>' +
    '<path class="vl-hill vl-hill-far" d="M0 62C120 40 220 50 330 56S560 34 700 46 900 58 1000 38V130H0Z"/>' +
    '<path class="vl-hill vl-hill-near" d="M0 90C150 72 260 88 420 81S700 66 820 80 960 86 1000 76V140H0Z"/>' +
    '<rect class="vl-ground" y="110" width="1000" height="890" fill="url(#vl-ground)"/>' +
    `<g class="vl-fields">${parts.join('')}</g>` +
    `<g class="vl-puddles">${puddles.join('')}</g>` +
    `<path class="vl-hedge" d="${hedges.join('')}"/>` +
    `<g class="vl-trees">${trees.join('')}</g>` +
    '<path class="vl-trail" d="M160 960C330 985 560 975 700 950S860 930 900 930"/>' +
    rain
  )
}
