// AAA UI font budget (docs/design/aaa-ui.md "Loading rule"): sums the woff2 each page ships and fails
// above 180 KiB (184,320 bytes) per page, or on any emitted woff2 that isn't a latin subset.
//
//   npx tsx scripts/font-budget.ts          every page in dist-site/ (after `npm run build:site`; gate 1)
//   npx tsx scripts/font-budget.ts --dist   Cathnivore alone in dist/ (after `npm run build`; npm run check)

import { existsSync, readdirSync, statSync } from 'node:fs'
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
  if (process.argv.includes('--verbose')) {
    for (const r of rows) for (const f of r.files) console.log(`  ${r.page}  ${relative(root, f)}  ${statSync(f).size}`)
  }
  if (problems.length) {
    console.error(`\nfont-budget failed:\n- ${problems.join('\n- ')}`)
    process.exitCode = 1
  } else console.log('\nfont-budget: every page is within budget, latin only.')
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main()
