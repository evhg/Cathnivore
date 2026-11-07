// Plan item 77: the valley the board sits in, painted down the whole frame and lit by the day. `sceneLight` turns
// a board's time and weather into a palette (pure, unit-tested); `valleyLayers` draws a patchwork of fields and
// hedgerows under a soft horizon, seeded per board, in the stage's own 0-1000 box (the SVG stretches to fit).
// The fills are CSS custom properties, so dark mode can mix the palette into the night paper.

import { hashString } from './engine'
import type { Sky, TimeOfDay } from './sky'

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
}

const BASE: Record<TimeOfDay, SceneLight> = {
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

export function sceneLight(sky: Pick<Sky, 'time' | 'weather'>): SceneLight {
  const base = BASE[sky.time]
  if (sky.weather === 'clear' || sky.weather === 'breeze') return { ...base }
  // Plan item 229: rain softens the colour, it doesn't take it away (0.5 grey and 10% dark turned the valley to slate).
  const [amount, dim] = sky.weather === 'drizzle' ? [0.3, 0.04] : [0.15, 0.02]
  const out = {} as SceneLight
  for (const k of Object.keys(base) as (keyof SceneLight)[]) out[k] = overcast(base[k], amount, dim)
  // A rain sky is a flat grey-blue whatever the hour; a cloudy one keeps a little of its colour.
  if (sky.weather === 'drizzle') {
    out.skyTop = overcast(base.skyTop, 0.75, 0.12)
    out.skyLow = overcast(base.skyLow, 0.6, 0.04)
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
  }
}

const KINDS = ['crop', 'wheat', 'grass', 'fallow', 'crop', 'grass'] as const

/**
 * The valley's painted layers (sky, far and near hills melting into the meadow, a patchwork of fields with furrows,
 * hedgerows along their edges, a few trees, Cath's footpath down to Bea's garden), seeded by the board.
 * Rows grow taller toward the foot, as fields do when the ground comes nearer.
 */
export function valleyLayers(seed: string, weather: Sky['weather']): string {
  const rnd = (k: number) => (hashString(`${seed}:valley:${k}`) % 10000) / 10000
  const rows = [250, 330, 450, 610, 800, 1010]
  const parts: string[] = []
  const hedges: string[] = []
  const trees: string[] = []
  const slope = (row: number, x: number) => rows[row]! + (rnd(row) - 0.5) * 40 * (x / 1000 - 0.5)
  let n = 0
  for (let r = 0; r < rows.length - 1; r++) {
    // Cut the row into 3-5 fields with seeded widths and slanted dividers.
    const count = 3 + Math.floor(rnd(100 + r) * 3)
    const cuts = [-40]
    for (let i = 1; i < count; i++) cuts.push(((i + (rnd(200 + r * 10 + i) - 0.5) * 0.6) / count) * 1000)
    cuts.push(1040)
    const lean = (rnd(300 + r) - 0.5) * 80 * (r + 1) / 3
    // Atmospheric depth: the far rows fade into the hills, so the horizon is soft.
    parts.push(`<g opacity="${[0.35, 0.6, 0.8, 0.92, 1][r]}">`)
    for (let i = 0; i < count; i++) {
      const xa = cuts[i]!, xb = cuts[i + 1]!
      const kind = KINDS[Math.floor(rnd(400 + n) * KINDS.length)]!
      const pts = [
        [xa, slope(r, xa)], [xb, slope(r, xb)], [xb + lean, slope(r + 1, xb + lean)], [xa + lean, slope(r + 1, xa + lean)],
      ].map(([x, y]) => `${x!.toFixed(0)},${y!.toFixed(0)}`).join(' ')
      parts.push(`<polygon class="vl-f vl-f-${kind}" points="${pts}"/>`)
      if (kind !== 'grass') {
        const pat = rnd(500 + n) < 0.5 ? 'vl-rows-h' : rnd(600 + n) < 0.5 ? 'vl-rows-d' : 'vl-rows-a'
        parts.push(`<polygon class="vl-furrow" fill="url(#${pat})" points="${pts}"/>`)
      }
      if (i > 0) hedges.push(`M${xa.toFixed(0)} ${slope(r, xa).toFixed(0)}L${(xa + lean).toFixed(0)} ${slope(r + 1, xa + lean).toFixed(0)}`)
      // An oak or two where the hedges meet.
      if (i > 0 && rnd(700 + n) < 0.55) {
        const tx = xa + lean * 0.5, ty = (slope(r, xa) + slope(r + 1, xa + lean)) / 2
        const s = 0.6 + r * 0.25
        trees.push(`<g class="vl-tree"><ellipse class="vl-tree-shade" cx="${(tx + 10 * s).toFixed(0)}" cy="${(ty + 14 * s).toFixed(0)}" rx="${(18 * s).toFixed(0)}" ry="${(6 * s).toFixed(0)}"/><ellipse cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" rx="${(16 * s).toFixed(0)}" ry="${(15 * s).toFixed(0)}"/><ellipse class="vl-tree-lit" cx="${(tx - 5 * s).toFixed(0)}" cy="${(ty - 5 * s).toFixed(0)}" rx="${(8 * s).toFixed(0)}" ry="${(7 * s).toFixed(0)}"/></g>`)
      }
      n++
    }
    parts.push('</g>')
    if (r > 0) hedges.push(`M-20 ${slope(r, -20).toFixed(0)}L1020 ${slope(r, 1020).toFixed(0)}`)
  }
  const rain =
    weather === 'drizzle' ? '<rect class="vl-rain" x="0" y="0" width="1000" height="1000" fill="url(#vl-rain)"/>' : ''
  return (
    '<defs>' +
    '<linearGradient id="vl-sky" x1="0" y1="0" x2="0" y2="1"><stop class="vl-sky-top" offset="0"/><stop class="vl-sky-low" offset="1"/></linearGradient>' +
    '<linearGradient id="vl-ground" x1="0" y1="0" x2="0" y2="1"><stop class="vl-g-near" offset="0"/><stop class="vl-g-meadow" offset=".12"/><stop class="vl-g-low" offset="1"/></linearGradient>' +
    '<pattern id="vl-rows-h" width="24" height="12" patternUnits="userSpaceOnUse"><path class="vl-row" d="M0 6h24"/></pattern>' +
    '<pattern id="vl-rows-d" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><path class="vl-row" d="M0 9h18"/></pattern>' +
    '<pattern id="vl-rows-a" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><path class="vl-row" d="M0 9h18"/></pattern>' +
    '<pattern id="vl-rain" width="40" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(14)"><path class="vl-drop" d="M8 4v14M28 34v14"/></pattern>' +
    '</defs>' +
    '<rect class="vl-sky" width="1000" height="320" fill="url(#vl-sky)"/>' +
    '<path class="vl-hill vl-hill-far" d="M0 120C120 70 220 90 330 105S560 60 700 85 900 110 1000 70V300H0Z"/>' +
    '<path class="vl-hill vl-hill-near" d="M0 170C150 130 260 165 420 150S700 120 820 150 960 160 1000 140V320H0Z"/>' +
    '<rect class="vl-ground" y="236" width="1000" height="764" fill="url(#vl-ground)"/>' +
    `<g class="vl-fields">${parts.join('')}</g>` +
    `<path class="vl-hedge" d="${hedges.join('')}"/>` +
    `<g class="vl-trees">${trees.join('')}</g>` +
    '<path class="vl-trail" d="M160 960C330 985 560 975 700 950S860 930 900 930"/>' +
    rain
  )
}
