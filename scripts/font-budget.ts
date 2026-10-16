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

/** Lints every stylesheet under games/cathode/src/styles; returns the problems. */
export function lintCathodeCss(): string[] {
  return cssUnder(resolve(root, 'games/cathode/src/styles')).flatMap((f) => cssPxProblems(readFileSync(f, 'utf8'), relative(root, f)))
}

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
    row('/cathode/', ['dist-site/cathode/assets']),
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
  const px = lintCathodeCss()
  problems.push(...px)
  console.log(`\nCATHODE stylesheets (S8 px lint): ${px.length ? `${px.length} raw px value(s)` : 'every size in --u'}`)
  if (process.argv.includes('--verbose')) {
    for (const r of rows) for (const f of r.files) console.log(`  ${r.page}  ${relative(root, f)}  ${statSync(f).size}`)
  }
  if (problems.length) {
    console.error(`\nfont-budget failed:\n- ${problems.join('\n- ')}`)
    process.exitCode = 1
  } else console.log('\nfont-budget: every page is within budget, latin only.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main()
