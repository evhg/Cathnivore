import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A var(--name) with no fallback whose --name is defined nowhere voids its whole declaration (a `font:` or
// `box-shadow:` shorthand included) without any error: the rival plate lost its type and the event ticket its edge
// that way (2026-11-05). Each app's CSS may only name custom properties that the app itself, or shared/, defines:
// in a stylesheet (`--x:`), or from script (`setProperty('--x'`, or a quoted '--x' key in a style object).
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (n === 'node_modules' || n.startsWith('.')) return []
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const SRC = /\.(css|ts|tsx|html|mjs)$/
const shared = walk('shared').filter((f) => SRC.test(f))

describe.each([['src'], ['games/runnel'], ['games/hedgerow'], ['games/cathode'], ['site'], ['portfolio']])('%s', (root) => {
  it('names only custom properties that are defined', () => {
    const files = [...walk(root).filter((f) => SRC.test(f)), ...shared, ...(root === 'src' ? ['index.html'] : [])]
    const defined = new Set<string>()
    for (const f of files) {
      const t = readFileSync(f, 'utf8')
      for (const re of [/(--[\w-]+)\s*:/g, /setProperty\(\s*['"`](--[\w-]+)/g, /['"`](--[\w-]+)['"`]/g, /(--[\w-]+)\$\{/g]) for (const m of t.matchAll(re)) defined.add(m[1]!)
    }
    const missing: string[] = []
    for (const f of files.filter((x) => x.endsWith('.css'))) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/var\(\s*(--[\w-]+)\s*(,)?/g)) if (!m[2] && !defined.has(m[1]!)) missing.push(`${m[1]} at ${f}:${i + 1}`)
        })
    }
    expect(missing).toEqual([])
  })
})
