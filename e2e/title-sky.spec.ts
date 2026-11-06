import { expect, test, type Page } from '@playwright/test'

// Plan item 206: the title market stands under a real sky. `[data-sky]` on the title root follows the player's clock
// (dawn, day, golden, evening) and the dark theme is always the evening; the menu's words and the logotype keep
// 4.5:1 on whatever is behind them in every state; the sky's box meets neither the menu nor the board; the lanterns
// don't flicker under reduced motion.

const STATES = [
  { hour: 6, sky: 'dawn', scheme: 'light' },
  { hour: 11, sky: 'day', scheme: 'light' },
  { hour: 17, sky: 'golden', scheme: 'light' },
  { hour: 21, sky: 'evening', scheme: 'light' },
  { hour: 11, sky: 'evening', scheme: 'dark' },
] as const

async function open(page: Page, hour: number, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme })
  await page.clock.setFixedTime(new Date(`2026-11-06T${String(hour).padStart(2, '0')}:30:00`))
  await page.goto('/')
  await page.locator('.title-cath svg').waitFor()
  await page.waitForTimeout(1800) // the title's fade-ins
}

/** The worst contrast between each element's own text colour and the commonest colour in its box (its background). */
async function worstContrast(page: Page, selectors: string[]): Promise<{ sel: string; ratio: number }[]> {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ({ shot, selectors }) => {
      const img = new Image()
      img.src = `data:image/png;base64,${shot}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.width
      c.height = img.height
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const scale = img.width / window.innerWidth
      const lum = (r: number, gg: number, b: number) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b)
      }
      const out: { sel: string; ratio: number }[] = []
      for (const sel of selectors) {
        for (const el of document.querySelectorAll<HTMLElement>(sel)) {
          const r = el.getBoundingClientRect()
          if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') continue
          const d = g.getImageData(Math.round(r.x * scale), Math.round(r.y * scale), Math.max(1, Math.round(r.width * scale)), Math.max(1, Math.round(r.height * scale))).data
          const hist = new Map<number, number>()
          for (let i = 0; i < d.length; i += 4) {
            const k = ((d[i]! >> 3) << 10) | ((d[i + 1]! >> 3) << 5) | (d[i + 2]! >> 3)
            hist.set(k, (hist.get(k) ?? 0) + 1)
          }
          const mode = [...hist.entries()].sort((a, b) => b[1] - a[1])[0]![0]
          const bg = [((mode >> 10) & 31) * 8 + 4, ((mode >> 5) & 31) * 8 + 4, (mode & 31) * 8 + 4] as const
          const fg = getComputedStyle(el).color.match(/[\d.]+/g)!.map(Number)
          const a = lum(fg[0]!, fg[1]!, fg[2]!)
          const b = lum(bg[0], bg[1], bg[2])
          out.push({ sel, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) })
        }
      }
      return out
    },
    { shot, selectors },
  )
}

for (const s of STATES) {
  test(`the ${s.sky} sky (${s.scheme}, ${s.hour}:30): words read and the sky stays off the menu and board`, async ({ page }, testInfo) => {
    test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
    await open(page, s.hour, s.scheme)
    await expect(page.locator('.title-screen')).toHaveAttribute('data-sky', s.sky)
    const ratios = await worstContrast(page, ['.title-kicker', '.title-wordmark', '.title-tagline', '.title-cta', '.title-minor button'])
    for (const r of ratios) expect(r.ratio, `${r.sel} ${r.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    const sky = (await page.locator('.title-sky').boundingBox())!
    for (const sel of ['.title-menu', '.title-board']) {
      const b = (await page.locator(sel).boundingBox())!
      expect(sky.y + sky.height, `the sky reaches ${sel}`).toBeLessThanOrEqual(b.y)
    }
  })
}

test('the evening lanterns hold still under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'once')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 21, 'light')
  const names = await page.locator('.title-lantern-glow').evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName))
  expect(names.length).toBeGreaterThan(0)
  expect(names.every((n) => n === 'none')).toBe(true)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const moving = await page.locator('.title-lantern-glow').first().evaluate((e) => getComputedStyle(e).animationName)
  expect(moving).not.toBe('none')
})
