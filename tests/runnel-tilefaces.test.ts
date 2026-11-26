import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sceneLight } from '../games/runnel/src/valley'
import { PLOT_GROUND, PLOT_TINT, TILE_GROUND, WET_FACE, deltaE, tileFaces } from '../games/runnel/src/tileFaces'

// Plan item 683: in the light scheme a dry plot reads apart from a watered field (ΔE 20+) and from every channel on
// the board (12+, any ground's, not only its own) in all 4 seasons x 4 hours x 4 weathers; the grounds come from
// tokens.css and the mixes are styles.css's own (checked below), so the model can't drift from what the browser draws.
const tokens = readFileSync('games/runnel/src/tokens.css', 'utf8')
const css = readFileSync('games/runnel/src/styles.css', 'utf8')
const base = (name: string) => tokens.match(new RegExp(`--${name}: (#[0-9a-f]{6})`))![1]!
const season = (s: string, name: string) => tokens.match(new RegExp(`data-season='${s}'\\] \\{[^}]*--${name}: (#[0-9a-f]{6})`))?.[1] ?? base(name)
const SEASONS = ['summer', 'spring', 'autumn', 'winter'].map((s) => ({ s, g: { field: season(s, 'dry-field'), fallow: season(s, 'dry'), meadow: season(s, 'dry-meadow') } }))

describe('Runnel tile faces under every sky (plan item 683)', () => {
  it('a dry plot is 20+ from a watered field and 12+ from every channel, in all 64 skies of each season', () => {
    let wet = 99, chan = 99, n = 0
    for (const { s, g } of SEASONS)
      for (const time of ['morning', 'noon', 'golden', 'dusk'] as const)
        for (const weather of ['clear', 'breeze', 'clouds', 'drizzle'] as const) {
          const L = sceneLight({ time, weather })
          const f = tileFaces(g, { field: L.wheat, fallow: L.fallow, meadow: L.meadow }, time)
          for (const p of f.plots) {
            n++
            wet = Math.min(wet, deltaE(p, f.wet))
            chan = Math.min(chan, ...f.channels.map((c) => deltaE(p, c)))
            expect(deltaE(p, f.wet), `${s}/${time}/${weather} wet`).toBeGreaterThanOrEqual(20)
            for (const c of f.channels) expect(deltaE(p, c), `${s}/${time}/${weather} channel`).toBeGreaterThanOrEqual(12)
          }
        }
    expect(n).toBe(192)
    expect(wet).toBeGreaterThan(20)
    expect(chan).toBeGreaterThan(12)
  })

  it('styles.css mixes the faces as the model does', () => {
    const g = `${Math.round(TILE_GROUND * 100)}%`
    for (const [k, v] of [['dry', 'fallow'], ['dry-field', 'wheat'], ['dry-meadow', 'meadow']])
      expect(css).toContain(`:not(.wet, .stone) .tile { fill: color-mix(in srgb, var(--${k}) ${g}, var(--vl-${v}, var(--${k}))); }`)
    expect(css.match(new RegExp(`50%, var\\(--vl-[a-z]+, var\\(--[a-z-]+\\)\\)\\) ${Math.round(PLOT_GROUND * 100)}%, var\\(--parched\\)\\)`, 'g'))).toHaveLength(3)
    expect(css).toContain('.stage .cell.field.wet:not(.reservoir) .tile { fill: var(--vl-wet, var(--wet-field)); }')
    expect(base('wet-field')).toBe('#4f7e33')
    expect(base('parched')).toBe(PLOT_TINT)
    for (const c of Object.values(WET_FACE)) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })
})
