// Plan item 683: Runnel's light-scheme tile faces over every season x hour x weather, as styles.css mixes them
// (a ground 50/50 with the hour's --vl-* in srgb; a dry plot that 63/37 with --wet-field in oklab), against
// runnel-bloom's bounds (a dry plot 20+ ΔE from a watered field, 12+ from any channel). Prints the worst sky.
// npx tsx scripts/runnel-683-model.ts
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
const rows: { k: string; wet: number; own: number; any: number }[] = []
for (const [sn, S] of Object.entries(SEAS))
  for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
    for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
      const L = sceneLight({ time, weather })
      const grounds: Record<string, [string, string]> = { field: [S.field, L.wheat], fallow: [S.dry, L.fallow], meadow: [S.meadow, L.meadow] }
      const ch = Object.values(grounds).map(([a, b]) => lab(mix(hex(a), hex(b), 0.5)))
      for (const [g, [a, b]] of Object.entries(grounds)) {
        const plot = mix(lab(mix(hex(a), hex(b), 0.5)), WET, 0.63)
        const own = lab(mix(hex(a), hex(b), 0.5))
        rows.push({ k: `${sn}/${time}/${weather}/${g}`, wet: dE(plot, WET), own: dE(plot, own), any: Math.min(...ch.map((c) => dE(plot, c))) })
      }
    }
const n = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length
console.log(`${rows.length} plots: wet < 20 in ${n((r) => r.wet < 20)}, own channel < 12 in ${n((r) => r.own < 12)}, some channel < 12 in ${n((r) => r.any < 12)}`)
for (const r of rows.filter((r) => r.wet < 20 || r.own < 12).sort((a, b) => a.wet - b.wet).slice(0, 8)) console.log(r.k, 'wet', r.wet.toFixed(1), 'own', r.own.toFixed(1), 'any', r.any.toFixed(1))
