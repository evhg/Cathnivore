// AAA UI shared foundation (docs/design/aaa-ui.md): one screenshot helper for every game.
//
//   shoot(page, name, sizes, opts)  screenshots at the standard sizes (P 390x844, L 844x390, D 1440x900),
//                                   optionally in dark and reduced-motion variants
//   contrastWalk(page)             walks visible text against its nearest opaque background, lists failures
//   guardCsp(page)                 collects CSP violations (and page errors) from the console
//
// Used by scripts/portfolio-shots.mjs and by e2e specs. Nothing here changes the page under test.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Page } from '@playwright/test'

export type SizeKey = 'P' | 'L' | 'D'
export const SIZES: Record<SizeKey, { width: number; height: number }> = {
  P: { width: 390, height: 844 },
  L: { width: 844, height: 390 },
  D: { width: 1440, height: 900 },
}

export type Variant = 'light' | 'dark' | 'reduced'

export interface ShootOptions {
  /** Output folder; files are `<dir>/<name>-<size>[-<variant>].png`. */
  dir: string
  variants?: Variant[]
  fullPage?: boolean
  /** Called after each resize or media change and before the shot (wait for layout, open a sheet). */
  settle?: (page: Page) => Promise<void>
}

export async function shoot(page: Page, name: string, sizes: SizeKey[], opts: ShootOptions): Promise<string[]> {
  const out: string[] = []
  for (const size of sizes) {
    await page.setViewportSize(SIZES[size])
    for (const variant of opts.variants ?? ['light']) {
      await page.emulateMedia({
        colorScheme: variant === 'dark' ? 'dark' : 'light',
        reducedMotion: variant === 'reduced' ? 'reduce' : 'no-preference',
      })
      if (opts.settle) await opts.settle(page)
      else await page.waitForTimeout(350)
      const path = `${opts.dir}/${name}-${size}${variant === 'light' ? '' : `-${variant}`}.png`
      mkdirSync(dirname(path), { recursive: true })
      await page.screenshot({ path, fullPage: opts.fullPage ?? false, timeout: 180_000 })
      out.push(path)
    }
  }
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' })
  return out
}

export interface ContrastFailure {
  text: string
  ratio: number
  need: number
  color: string
  background: string
}

/** Text whose colour against its nearest opaque ancestor background is under WCAG AA. Elements over
 *  images, gradients or canvases are skipped (no reliable backdrop to measure against). */
export async function contrastWalk(page: Page): Promise<ContrastFailure[]> {
  // tsx/esbuild's keepNames wraps inner functions in __name(); give the page a no-op one.
  await page.evaluate('globalThis.__name = globalThis.__name || ((f) => f)')
  return page.evaluate(() => {
    const parse = (c: string): [number, number, number, number] | null => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1]!.split(/[\s,/]+/).filter(Boolean).map(Number)
      return [p[0]!, p[1]!, p[2]!, p[3] ?? 1]
    }
    const lum = ([r, g, b]: number[]): number => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
    }
    const fails: ContrastFailure[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set<Element>()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!el || seen.has(el) || !n.textContent?.trim()) continue
      seen.add(el)
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (cs.visibility === 'hidden' || r.width === 0 || r.height === 0 || el.closest('[aria-hidden="true"],svg')) continue
      if (r.bottom < 0 || r.top > innerHeight) continue
      const fg = parse(cs.color)
      if (!fg || fg[3] < 0.99) continue
      let bg: [number, number, number, number] | null = null
      let unknown = false
      for (let a: Element | null = el; a; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (s.backgroundImage !== 'none' || a.tagName === 'CANVAS') {
          unknown = true
          break
        }
        const c = parse(s.backgroundColor)
        if (c && c[3] >= 0.99) {
          bg = c
          break
        }
        if (c && c[3] > 0.05) {
          unknown = true
          break
        }
      }
      if (unknown || !bg) continue
      const l1 = lum(fg)
      const l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const px = parseFloat(cs.fontSize)
      const large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
      const need = large ? 3 : 4.5
      if (ratio < need) fails.push({ text: n.textContent.trim().slice(0, 40), ratio: Math.round(ratio * 100) / 100, need, color: cs.color, background: `rgb(${bg.slice(0, 3).join(' ')})` })
    }
    return fails
  })
}

/** Collects CSP violations and uncaught errors for the life of the page. */
export function guardCsp(page: Page): { csp: string[]; errors: string[] } {
  const out = { csp: [] as string[], errors: [] as string[] }
  page.on('console', (m) => {
    const t = m.text()
    if (/Content Security Policy|Refused to (load|apply|execute)/i.test(t)) out.csp.push(t)
  })
  page.on('pageerror', (e) => out.errors.push(String(e)))
  return out
}
