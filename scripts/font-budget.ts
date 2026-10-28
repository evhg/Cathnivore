// AAA UI font budget (docs/design/aaa-ui.md "Loading rule"): sums the woff2 each page ships and fails
// above 180 KiB (184,320 bytes) per page, or on any emitted woff2 that isn't a latin subset.
//
//   npx tsx scripts/font-budget.ts          every page in dist-site/ (after `npm run build:site`; gate 1)
//   npx tsx scripts/font-budget.ts --dist   Cathnivore alone in dist/ (after `npm run build`; npm run check)
//
// It also lints CATHODE's stylesheets (docs/design/cathode-combat.md S8): every size in games/cathode/src/styles
// is written in the HUD unit --u, so the HUD scales from a phone to 5K. A raw px value fails unless it is 0 or
// a 1 px hairline, the first argument of max() (a floor, like max(12px, calc(var(--u) * 15))), on an @media
// line, on a line marked /* px-ok */ (a reason may follow), or between /* px-ok:begin */ and /* px-ok:end */ (touch tap targets).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

export const BUDGET_BYTES = 180 * 1024

const root = resolve(import.meta.dirname, '..')

function woff2Under(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...woff2Under(p))
    else if (name.endsWith('.woff2')) out.push(p)
  }
  return out
}

/** A file is latin-only when its name says `-latin-` and no other subset (latin-ext, cyrillic, greek,
 *  vietnamese, ...). Logotype subsets in /marks are cut to a handful of latin glyphs by name. */
export function isLatinOnly(file: string): boolean {
  const base = file.split('/').pop()!.toLowerCase()
  if (/latin-ext|cyrillic|greek|vietnamese|hebrew|arabic|devanagari|math|symbols/.test(base)) return false
  return base.includes('-latin-') || file.includes('/marks/')
}

/** Raw px in a CATHODE stylesheet (S8): one message per offending value, with its line number. */
export function cssPxProblems(css: string, file = 'css'): string[] {
  const out: string[] = []
  let ok = false
  let inComment = false
  css.split('\n').forEach((raw, i) => {
    if (raw.includes('px-ok:begin')) ok = true
    if (raw.includes('px-ok:end')) ok = false
    if (ok || /\/\* px-ok\b/.test(raw)) return
    // Comments are prose ("a 2px band"), not sizes: drop them, across lines too.
    let line = ''
    for (let j = 0; j < raw.length; j++) {
      if (inComment) {
        if (raw.startsWith('*/', j)) {
          inComment = false
          j++
        }
      } else if (raw.startsWith('/*', j)) {
        inComment = true
        j++
      } else line += raw[j]
    }
    if (/^\s*@media\b/.test(line)) return
    for (const m of line.matchAll(/(?<![\w.#-])(-?\d*\.?\d+)px\b/g)) {
      const v = Math.abs(Number(m[1]))
      if (v === 0 || v === 1) continue
      if (/max\(\s*$/.test(line.slice(0, m.index))) continue
      out.push(`${file}:${i + 1}: raw ${m[0]} (write it in var(--u), or floor it with max(${m[0]}, ...))`)
    }
  })
  return out
}

function cssUnder(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? cssUnder(p) : name.endsWith('.css') ? [p] : []
  })
}

/** The two CATHODE families (C13T): the grotesk for every word of UI, and the serif for Cath's voice. */
export const CATHODE_FAMILIES = ['var(--font-ui)', 'var(--font-voice)']
/** The type scale (C13T): six size tokens and no others. */
const SIZE = /^var\(--fs-[1-6]\)$/
const FONT_SHORTHAND = /^(?:(?:italic|normal)\s+)?(?:(?:\d{3}|bold|normal)\s+)?var\(--fs-[1-6]\)\s*(?:\/\s*[\d.]+\s*)?var\(--font-(?:ui|voice)\)$/
/** Wide tracking reads as a template: caps labels get at most 0.06em, sentences 0. */
export const MAX_TRACKING_EM = 0.06

/**
 * C13T type rules for a CATHODE stylesheet: every font-family is one of the two tokens, every font size one of
 * the six --fs tokens (in font-size or a font shorthand), and no letter-spacing above 0.06em (em only, no var()).
 * `inherit` passes. @font-face blocks are skipped; a line marked /* fs-ok *\/ (the html rem base) is exempt.
 */
export function cssTypeProblems(css: string, file = 'css'): string[] {
  const out: string[] = []
  let inComment = false
  let inFace = false
  css.split('\n').forEach((raw, i) => {
    if (/\/\* fs-ok\b/.test(raw)) return
    let line = ''
    for (let j = 0; j < raw.length; j++) {
      if (inComment) {
        if (raw.startsWith('*/', j)) {
          inComment = false
          j++
        }
      } else if (raw.startsWith('/*', j)) {
        inComment = true
        j++
      } else line += raw[j]
    }
    if (/@font-face/.test(line)) inFace = true
    if (inFace) {
      if (line.includes('}')) inFace = false
      return
    }
    const at = `${file}:${i + 1}`
    for (const m of line.matchAll(/(?<![\w-])(font-family|font-size|font|letter-spacing)\s*:\s*([^;{}]+)/g)) {
      const prop = m[1]
      const v = (m[2] ?? '').trim()
      if (v === 'inherit') continue
      if (prop === 'font-family' && !CATHODE_FAMILIES.includes(v)) out.push(`${at}: font-family ${v} (use var(--font-ui) or var(--font-voice))`)
      if (prop === 'font-size' && !SIZE.test(v)) out.push(`${at}: font-size ${v} (use one of var(--fs-1) to var(--fs-6))`)
      if (prop === 'font' && !FONT_SHORTHAND.test(v)) out.push(`${at}: font ${v} (a weight, var(--fs-N), an optional /line-height, and a family token)`)
      if (prop === 'letter-spacing') {
        const n = /^(-?\d*\.?\d+)em$/.exec(v)
        if (!(v === '0' || v === 'normal' || (n && Number(n[1]) <= MAX_TRACKING_EM))) out.push(`${at}: letter-spacing ${v} (at most ${MAX_TRACKING_EM}em)`)
      }
    }
  })
  return out
}

/** Lints CATHODE's stylesheets: the S8 px rule under games/cathode/src/styles, the C13T type rules everywhere in
 *  games/cathode/src. Returns the problems. */
export function lintCathodeCss(): string[] {
  const px = cssUnder(resolve(root, 'games/cathode/src/styles')).flatMap((f) => cssPxProblems(readFileSync(f, 'utf8'), relative(root, f)))
  const type = cssUnder(resolve(root, 'games/cathode/src')).flatMap((f) => cssTypeProblems(readFileSync(f, 'utf8'), relative(root, f)))
  return [...px, ...type]
}

/** The font families a built page declares with @font-face (metric fallbacks, named "... Fallback", don't count). */
export function familiesIn(css: string): string[] {
  const names = new Set<string>()
  for (const m of css.matchAll(/@font-face\s*\{[^}]*?font-family\s*:\s*["']?([^;"'}]+)["']?/g)) {
    const n = (m[1] ?? '').trim()
    if (!/fallback$/i.test(n)) names.add(n)
  }
  return [...names]
}
/** C13T: /nightshift/ ships at most two families. */
export const CATHODE_MAX_FAMILIES = 2

interface PageRow {
  page: string
  files: string[]
  bytes: number
}

function pages(dist: boolean): PageRow[] {
  const row = (page: string, dirs: string[]): PageRow => {
    const files = dirs.flatMap((d) => woff2Under(resolve(root, d)))
    return { page, files, bytes: files.reduce((n, f) => n + statSync(f).size, 0) }
  }
  if (dist) return [row('/ (Cathnivore, dist/)', ['dist/assets'])]
  return [
    row('/', ['dist-site/site-assets', 'dist-site/marks']),
    row('/cathnivore/', ['dist-site/cathnivore/assets']),
    row('/runnel/', ['dist-site/runnel/assets']),
    row('/hedgerow/', ['dist-site/hedgerow/assets']),
    row('/nightshift/', ['dist-site/nightshift/assets']),
  ]
}

function main(): void {
  const dist = process.argv.includes('--dist')
  const where = dist ? 'dist' : 'dist-site'
  if (!existsSync(resolve(root, where))) {
    console.error(`font-budget: ${where}/ is missing; build first.`)
    process.exitCode = 1
    return
  }
  const rows = pages(dist)
  const problems: string[] = []
  console.log('\nFont budget (woff2 per page, limit 180 KiB = 184,320 bytes)\n')
  console.log('| Page | Files | Bytes | KB | KiB | Result |')
  console.log('|---|---|---|---|---|---|')
  for (const r of rows) {
    const bad = r.files.filter((f) => !isLatinOnly(f))
    const over = r.bytes > BUDGET_BYTES
    if (over) problems.push(`${r.page} ships ${r.bytes} bytes of fonts, over ${BUDGET_BYTES}`)
    for (const f of bad) problems.push(`${r.page} ships a non-latin font file: ${relative(root, f)}`)
    const ok = !over && bad.length === 0
    console.log(`| ${r.page} | ${r.files.length} | ${r.bytes} | ${(r.bytes / 1000).toFixed(1)} | ${(r.bytes / 1024).toFixed(1)} | ${ok ? 'ok' : 'FAIL'} |`)
  }
  if (!dist) {
    const dir = resolve(root, 'dist-site/nightshift/assets')
    const css = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith('.css')).map((n) => readFileSync(join(dir, n), 'utf8')).join('\n') : ''
    const fams = familiesIn(css)
    console.log(`\n/cathode/ font families: ${fams.join(', ') || 'none'} (limit ${CATHODE_MAX_FAMILIES})`)
    if (fams.length > CATHODE_MAX_FAMILIES) problems.push(`/nightshift/ declares ${fams.length} font families (${fams.join(', ')}), over ${CATHODE_MAX_FAMILIES}`)
  }
  const px = lintCathodeCss()
  problems.push(...px)
  console.log(`\nCATHODE stylesheets (S8 px lint, C13T type lint): ${px.length ? `${px.length} problem(s)` : 'every size in --u and on the six-step scale, two families, tracking at most 0.06em'}`)
  if (process.argv.includes('--verbose')) {
    for (const r of rows) for (const f of r.files) console.log(`  ${r.page}  ${relative(root, f)}  ${statSync(f).size}`)
  }
  if (problems.length) {
    console.error(`\nfont-budget failed:\n- ${problems.join('\n- ')}`)
    process.exitCode = 1
  } else console.log('\nfont-budget: every page is within budget, latin only.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main()
