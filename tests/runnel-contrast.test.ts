import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Plan item 30: the channels read at a glance. Every Runnel palette (the summer base, the light seasons and the
// night palette) keeps a dry channel at 3:1 or more against its dry tile, and a wet channel against its wet tile.

const css = readFileSync(new URL('../games/runnel/src/tokens.css', import.meta.url), 'utf8')

/** The custom properties declared in the first block whose selector line matches `head`, from `from` on. */
function block(head: RegExp, from = 0): Record<string, string> {
  const m = head.exec(css.slice(from))
  if (!m) throw new Error(`no block ${head}`)
  const start = from + m.index + m[0].length
  const body = css.slice(start, css.indexOf('}', start))
  const out: Record<string, string> = {}
  for (const d of body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})/gi)) out[d[1]!] = d[2]!
  return out
}

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

const base = block(/:root\s*\{/)
const darkAt = css.indexOf('prefers-color-scheme: dark')
const lightAt = css.indexOf('prefers-color-scheme: light')
const palettes: Record<string, Record<string, string>> = {
  summer: base,
  spring: { ...base, ...block(/:root\[data-season='spring'\]\s*\{/, lightAt) },
  autumn: { ...base, ...block(/:root\[data-season='autumn'\]\s*\{/, lightAt) },
  winter: { ...base, ...block(/:root\[data-season='winter'\]\s*\{/, lightAt) },
  night: { ...base, ...block(/:root\s*\{/, darkAt) },
}

describe('Runnel channel contrast (plan item 30)', () => {
  for (const [name, p] of Object.entries(palettes)) {
    it(`${name}: dry and wet channels stand 3:1 or more off their tiles`, () => {
      // Plan item 50: every dry ground (fallow, meadow, field) keeps the floor.
      for (const ground of ['--dry', '--dry-meadow', '--dry-field']) expect(contrast(p['--groove']!, p[ground]!), ground).toBeGreaterThanOrEqual(3)
      expect(contrast(p['--groove-wet']!, p['--wet']!)).toBeGreaterThanOrEqual(3)
    })
  }
})

// Plan item 61: the ditch's halves. Whichever way the light falls, one slope of every dry ditch stands 3:1 or more
// off its ground, and the water stands off the bed it runs in.
describe('Runnel ditch contrast (plan item 61)', () => {
  for (const [name, p] of Object.entries(palettes)) {
    it(`${name}: a slope of every ditch reads on every ground, and the water on its bed`, () => {
      for (const ground of ['--dry', '--dry-meadow', '--dry-field']) {
        const best = Math.max(contrast(p['--bank-sun']!, p[ground]!), contrast(p['--bank-shade']!, p[ground]!))
        expect(best, ground).toBeGreaterThanOrEqual(3)
      }
      expect(Math.max(contrast(p['--bank-sun']!, p['--wet']!), contrast(p['--bank-shade']!, p['--wet']!))).toBeGreaterThanOrEqual(3)
      expect(contrast(p['--water']!, p['--groove-bed-wet']!)).toBeGreaterThanOrEqual(2)
    })
  }
})
