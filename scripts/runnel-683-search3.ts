// Plan item 683: channels take less of the hour (season ground share g), a dry plot stays today's (its own ground at
// 50% mixed 63/37 with the wet green, so runnel-tiles' ditch keeps 3:1), and the watered field darkens with the hour.
import { sceneLight } from '../games/runnel/src/valley'
const SEAS = { summer: { dry: '#ecd7a9', meadow: '#dfe3b3', field: '#f0d38c' }, spring: { dry: '#ecd7a9', meadow: '#d9e8b0', field: '#ecd79a' }, autumn: { dry: '#ead0a0', meadow: '#e3d9a0', field: '#f2cd96' }, winter: { dry: '#e6e3d6', meadow: '#dce6d6', field: '#e9dfc8' } }
type V3 = [number, number, number]
const hex = (h: string): V3 => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as V3
const lin = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)
const lab = (c: V3): V3 => {
  const [r, g, b] = c.map(lin) as V3
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675778 * s]
}
const mix = (a: V3, b: V3, k: number): V3 => a.map((v, i) => v * k + b[i]! * (1 - k)) as V3
const mixS = (a: string, b: string, k: number) => lab(mix(hex(a), hex(b), k))
const dE = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100
const WET = lab(hex('#4f7e33'))
const TIMES = ['morning', 'noon', 'golden', 'dusk'] as const
for (const g of [0.5, 0.6, 0.65, 0.7, 0.75, 0.8, 0.9, 1]) for (const p of [0.63, 0.6, 0.58, 0.55]) {
  let any = 99, worst = ''
  const need: Record<string, number> = {}
  for (const [sn, S] of Object.entries(SEAS)) for (const time of TIMES) for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
    const L = sceneLight({ time, weather })
    const pairs = [[S.field, L.wheat], [S.dry, L.fallow], [S.meadow, L.meadow]] as const
    const ch = pairs.map(([a, b]) => mixS(a, b, g))
    const plots = pairs.map(([a, b]) => mix(mixS(a, b, 0.5), WET, p))
    for (const pl of plots) { const v = Math.min(...ch.map((x) => dE(pl, x))); if (v < any) { any = v; worst = `${sn}/${time}/${weather}` } }
    let d = need[time] ?? 0
    while (d < 0.3 && Math.min(...plots.map((q) => dE(q, [WET[0] - d, WET[1] * (1 - d), WET[2] * (1 - d)]))) < 20.5) d += 0.005
    need[time] = d
  }
  console.log('g', g, 'p', p, 'any', any.toFixed(1), worst, 'wetD', JSON.stringify(need))
}
