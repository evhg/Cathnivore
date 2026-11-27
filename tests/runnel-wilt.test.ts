import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sceneLight } from '../games/runnel/src/valley'
import { oklab, tileFaces } from '../games/runnel/src/tileFaces'

// Plan item 729: a dry field holds its own crop wilted (not one generic seedling), inked so it reads 3:1+ on its
// clay plot in every season, hour and weather of the light scheme and at night; water revives it.
const tokens = readFileSync('games/runnel/src/tokens.css', 'utf8')
const css = readFileSync('games/runnel/src/styles.css', 'utf8')
const board = readFileSync('games/runnel/src/board.ts', 'utf8')
const darkAt = tokens.indexOf('prefers-color-scheme: dark')
const tok = (name: string, from = 0) => tokens.slice(from).match(new RegExp(`--${name}: (#[0-9a-f]{6})`))![1]!
const season = (s: string, name: string) => tokens.match(new RegExp(`data-season='${s}'\\] \\{[^}]*--${name}: (#[0-9a-f]{6})`))?.[1] ?? tok(name)

type V3 = [number, number, number]
/** Relative luminance (WCAG) of an OKLab colour. */
function lumOk([L, a, b]: V3): number {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return 0.2126 * r + 0.7152 * g + 0.0722 * bb
}
const ratio = (x: number, y: number) => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
const mix = (a: V3, b: V3, k: number): V3 => a.map((v, i) => v * k + b[i]! * (1 - k)) as V3

describe('Runnel wilted crops (plan item 729)', () => {
  it('every field crop has a grown drawing and a wilted pose', () => {
    const crops = [...board.matchAll(/case '(wheat|cabbage|carrot|sunflower|pumpkin)':/g)].map((m) => m[1])
    expect(new Set(crops)).toEqual(new Set(['wheat', 'cabbage', 'carrot', 'sunflower', 'pumpkin']))
    for (const c of crops) expect(css, `${c} leans when dry`).toMatch(new RegExp(`\\.field-plot \\.crop-${c} \\{ --wilt-lean: \\d+deg; \\}`))
    expect(css).toContain('.cell.field:not(.wet) .field-plot .crop {')
    expect(css).toContain('.cell.field.wet .field-plot .crop {')
    // the dry crop is drawn (not scaled to nothing) and every part's line takes the wilt ink
    const dry = css.slice(css.indexOf('.cell.field:not(.wet) .field-plot .crop {'))
    expect(dry.slice(0, dry.indexOf('}'))).toMatch(/opacity: 1;[\s\S]*scale\(calc\(var\(--grown\) \* 0\.62\)\)/)
    expect(css).toMatch(/\.cell\.field:not\(\.wet\) \.field-plot \.crop :is\(\.stalk, \.frond, \.vein\) \{ stroke: var\(--wilt-ink\); \}/)
    expect(board).toContain("root.dataset.crop = 'revived'")
  })

  it('the wilt ink reads 3:1+ on a dry plot under all 64 light skies of each season', () => {
    const ink = lumOk(oklab(tok('wilt-ink')))
    let worst = 99
    for (const s of ['summer', 'spring', 'autumn', 'winter'])
      for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
        for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
          const L = sceneLight({ time, weather })
          const f = tileFaces({ field: season(s, 'dry-field'), fallow: season(s, 'dry'), meadow: season(s, 'dry-meadow') }, { field: L.wheat, fallow: L.fallow, meadow: L.meadow }, time)
          for (const p of f.plots) worst = Math.min(worst, ratio(lumOk(p), ink))
        }
    expect(worst).toBeGreaterThanOrEqual(3)
  })

  it('at night the light wilt ink reads 3:1+ on the dark plot', () => {
    expect(css).toContain(':root:not([data-theme="light"]) .cell.field:not(.reservoir):not(.wet) .tile { fill: color-mix(in oklab, var(--dry-field) 70%, var(--parched)); }')
    const plot = mix(oklab(tok('dry-field', darkAt)), oklab(tok('parched', darkAt)), 0.7)
    expect(ratio(lumOk(plot), lumOk(oklab(tok('wilt-ink', darkAt))))).toBeGreaterThanOrEqual(3)
  })
})
