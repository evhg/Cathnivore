// Plan item 683: the light scheme's tile faces under every sky, as styles.css mixes them, so a dry plot reads apart
// from a watered field (OKLab ΔE x100 20+) and from every channel on the board (12+) in each season, hour and weather.
// A channel keeps most of its season's ground (TILE_GROUND of it, the rest the hour's valley field), a dry plot is
// its ground half lit by the hour with a share of sun-baked clay (plan item 711; never darker than item 646's, so runnel-tiles'
// ditch keeps 3:1 on it), and a watered field deepens as the light goes (`--vl-wet`, set beside the valley's vars).
import type { TimeOfDay } from './sky'

/** A channel tile's share of its season's ground (the rest is the hour's valley field). styles.css: 80%. */
export const TILE_GROUND = 0.8
/** A dry plot's share of its hour-lit ground (the rest is sun-baked clay, --parched: plan item 711; it was the crop's
 *  green, so a dry field looked watered). styles.css: 58%. */
export const PLOT_GROUND = 0.58
/** Plan item 711: the light scheme's parched clay (tokens.css --parched), at the old green's luminance so the ditch keeps 3:1. */
export const PLOT_TINT = '#ba462c'
/** The light scheme's watered field, deepened by the hour: the crop's #4f7e33 with OKLab L 0.045 lower (and chroma
 *  4.5% less) by day, 0.05 at golden hour and 0.085 at dusk (scripts/runnel-683-search3.ts' least, plus a margin). */
export const WET_FACE: Record<TimeOfDay, string> = { morning: '#447029', noon: '#447029', golden: '#436f28', dusk: '#3a6420' }

/** --vl-wet for the hour (the light scheme's watered field face). */
export const wetVars = (time: TimeOfDay): Record<string, string> => ({ '--vl-wet': WET_FACE[time] })

type V3 = [number, number, number]
const hex = (h: string): V3 => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as V3
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
/** OKLab of a #rrggbb colour. */
export function oklab(c: string | V3): V3 {
  const [r, g, b] = (typeof c === 'string' ? hex(c) : c).map(lin) as V3
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675778 * s]
}
const mix = (a: V3, b: V3, k: number): V3 => a.map((v, i) => v * k + b[i]! * (1 - k)) as V3
/** ΔE in OKLab x100, as runnel-bloom measures it. */
export const deltaE = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100

/** A season's three grounds and the hour's matching valley fields (sceneLight's wheat, fallow, meadow). */
export interface Grounds { field: string; fallow: string; meadow: string }

/** The faces styles.css draws (OKLab): each ground's channel and dry plot, and the watered field. */
export function tileFaces(season: Grounds, hour: Grounds, time: TimeOfDay, plotTint = PLOT_TINT) {
  const kinds = ['field', 'fallow', 'meadow'] as const
  const srgb = (k: (typeof kinds)[number], g: number) => mix(hex(season[k]), hex(hour[k]), g)
  return {
    channels: kinds.map((k) => oklab(srgb(k, TILE_GROUND))),
    plots: kinds.map((k) => mix(oklab(srgb(k, 0.5)), oklab(plotTint), PLOT_GROUND)),
    wet: oklab(WET_FACE[time]),
  }
}
