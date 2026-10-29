// AAA UI lint ratchet (docs/design/aaa-ui.md "Shared foundation"). Counts per file may only go down
// against tests/ui-css-baseline.json; a file missing from the baseline must be clean.
// Regenerate the baseline after an intentional cut: UPDATE_UI_CSS_BASELINE=1 npx vitest run tests/ui-css-lint.test.ts
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const BASELINE = resolve(root, 'tests/ui-css-baseline.json')
const SCAN = ['src', 'site/src', 'site/index.html', 'portfolio/src', 'portfolio/index.html', 'games', 'shared', 'index.html', 'public/pages.css']
const SKIP = /node_modules|\/dist|\/public\/(?!pages\.css)|\.test\.|games\/[^/]+\/src\/(sim|render|render3d)\//

function walk(p: string): string[] {
  const abs = resolve(root, p)
  if (!existsSync(abs)) return []
  if (!statSync(abs).isDirectory()) return [abs]
  return readdirSync(abs).flatMap((n) => walk(relative(root, join(abs, n))))
}

const files = [...new Set(SCAN.flatMap(walk))]
  .map((f) => relative(root, f))
  .filter((f) => /\.(css|html|ts|tsx)$/.test(f) && !SKIP.test(f))

/** Token files may hold raw colours; everything else names a token. */
const isTokenFile = (f: string) => /(^|\/)(tokens|palette|fonts|base)\.css$/.test(f)

function gameOf(f: string): string {
  const m = f.match(/^games\/([^/]+)\//)
  if (m) return m[1]!
  if (f.startsWith('site/')) return 'site'
  if (f.startsWith('portfolio/')) return 'portfolio'
  if (f.startsWith('shared/')) return 'shared'
  return 'cathnivore'
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

/** Families whose italic is a real face, per game, read from every @font-face in that game's CSS. */
function italicFamilies(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const f of files.filter((x) => x.endsWith('.css'))) {
    const css = readFileSync(resolve(root, f), 'utf8')
    for (const block of css.match(/@font-face\s*{[^}]*}/g) ?? []) {
      if (!/font-style:\s*italic/.test(block)) continue
      const fam = block.match(/font-family:\s*["']?([^;"']+)/)?.[1]?.trim()
      if (!fam) continue
      const g = gameOf(f)
      if (!out.has(g)) out.set(g, new Set())
      out.get(g)!.add(fam)
    }
  }
  return out
}

const ALLOWED_WEIGHTS: Array<[RegExp, (w: number) => boolean]> = [
  [/Archivo/, (w) => w >= 100 && w <= 900],
  [/Nunito/, (w) => w >= 200 && w <= 1000],
  [/Atkinson/, (w) => w >= 200 && w <= 800],
  [/Figtree|Outfit/, (w) => w >= 100 && w <= 900],
]

type Counts = Record<string, number>

function measure(f: string, italics: Map<string, Set<string>>): Counts {
  const raw = readFileSync(resolve(root, f), 'utf8')
  // comments don't count (a note may name a font the file must not use)
  const src = f.endsWith('.css') ? raw.replace(/\/\*[\s\S]*?\*\//g, '') : raw
  const c: Counts = {}
  const put = (k: string, n: number) => {
    if (n) c[k] = n
  }
  if (f.endsWith('.css')) {
    const noFaces = src.replace(/@font-face\s*{[^}]*}/g, '')
    put('px-font-size', count(noFaces, /font-size:\s*[\d.]+px/g))
    put('z-index-literal', count(src, /z-index:\s*-?\d+/g))
    if (!isTokenFile(f)) put('raw-colour', count(noFaces, /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g))
    if (!(italics.get(gameOf(f))?.size)) put('italic-without-face', count(noFaces, /font-style:\s*italic/g))
    put('font-face-legacy-path', count(src, /url\(\s*["']?\/fonts\//g))
    let badWeights = 0
    for (const block of noFaces.split('}')) {
      const fam = block.match(/font-family:[^;]*/)?.[0]
      const w = Number(block.match(/font-weight:\s*(\d+)/)?.[1])
      if (!fam || !w) continue
      for (const [re, ok] of ALLOWED_WEIGHTS) if (re.test(fam) && !ok(w)) badWeights++
    }
    put('weight-outside-family', badWeights)
  }
  if (f.startsWith('games/cathode/')) put('house-font-in-cathode', count(src, /Fraunces|Atkinson/g))
  if (/\.(html|ts|tsx)$/.test(f)) {
    put('style-attribute', count(src, /\bstyle="/g))
    put('style-prop-assign', count(src, /\.style\.(?!setProperty|removeProperty|getPropertyValue|cssText\b)[a-zA-Z]+\s*=(?!=)/g))
  }
  return c
}

const italics = italicFamilies()
const current: Record<string, Counts> = {}
for (const f of files.sort()) {
  const c = measure(f, italics)
  if (Object.keys(c).length) current[f] = c
}

if (process.env.UPDATE_UI_CSS_BASELINE) writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n')
const baseline: Record<string, Counts> = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}

describe('UI CSS ratchet', () => {
  it('scans the portfolio', () => {
    expect(files.length).toBeGreaterThan(20)
  })
  it('never goes above the committed baseline', () => {
    const worse: string[] = []
    for (const [f, c] of Object.entries(current)) {
      for (const [rule, n] of Object.entries(c)) {
        const allowed = baseline[f]?.[rule] ?? 0
        if (n > allowed) worse.push(`${f}: ${rule} ${n} > baseline ${allowed}`)
      }
    }
    expect(worse, 'Fix the new occurrences (see docs/design/aaa-ui.md) rather than raising the baseline').toEqual([])
  })
  it('the shared foundation itself is clean', () => {
    for (const f of Object.keys(current).filter((x) => x.startsWith('shared/ui/'))) {
      const c = current[f]!
      expect(c['style-attribute'] ?? 0, f).toBe(0)
      expect(c['style-prop-assign'] ?? 0, f).toBe(0)
      expect(c['px-font-size'] ?? 0, f).toBe(0)
    }
  })
})
