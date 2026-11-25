// Plan item 683: search a dry plot as its own channel's face shifted by a fixed OKLab offset (tilled earth: redder,
// a little darker), against runnel-bloom's bounds in every season x hour x weather. npx tsx scripts/runnel-683-search.ts
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
const dE = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100
const WET = lab(hex('#4f7e33'))
const skies: { ch: V3[]; own: V3[] }[] = []
for (const S of Object.values(SEAS))
  for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
    for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
      const L = sceneLight({ time, weather })
      const ch = ([[S.field, L.wheat], [S.dry, L.fallow], [S.meadow, L.meadow]] as const).map(([a, b]) => lab(mix(hex(a), hex(b), 0.5)))
      skies.push({ ch, own: ch })
    }
const out: { D: V3; wet: number; any: number; L: number }[] = []
for (let dL = -0.06; dL <= 0.0001; dL += 0.01) for (let da = 0; da <= 0.1001; da += 0.01) for (let db = -0.02; db <= 0.06; db += 0.01) {
  let wet = 99, any = 99, minL = 9
  for (const s of skies) for (const c of s.own) {
    const p: V3 = [c[0] + dL, c[1] + da, c[2] + db]
    wet = Math.min(wet, dE(p, WET)); any = Math.min(any, ...s.ch.map((x) => dE(p, x))); minL = Math.min(minL, p[0])
  }
  out.push({ D: [dL, da, db].map((x) => +x.toFixed(2)) as V3, wet, any, L: minL })
}
out.sort((a, b) => Math.min(b.wet - 20, b.any - 12) - Math.min(a.wet - 20, a.any - 12) || Math.hypot(...a.D) - Math.hypot(...b.D))
for (const o of out.slice(0, 6)) console.log(JSON.stringify(o.D), 'wet', o.wet.toFixed(1), 'any', o.any.toFixed(1), 'minL', o.L.toFixed(2))
