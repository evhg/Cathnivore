import { expect, test, type Page } from '@playwright/test'

// Plan item 214: on an upright phone Cath's powers are a labelled dock, as on a desktop: each power token is
// 44 px or more with its name showing under it at 11 px or more, the Keep going switch keeps its aria-label and
// shows its caption, and the dock meets neither Go nor Cath's docked line.
type Hg = { game(): unknown }
type R = { x: number; y: number; width: number; height: number }

async function open(page: Page, level: number): Promise<void> {
  const tips = { build: true, hero: true, early: true, pie: true, spec: true, neighbours: true, rally: true, move: true }
  const stars = Object.fromEntries(Array.from({ length: level - 1 }, (_, i) => [String(i + 1), 3]))
  await page.goto('/hedgerow/?sandbox=1&2d')
  await page.evaluate(([s, t, l]) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: s, seenBefore: { [l]: true }, tips: t })), [stars, tips, level] as const)
  await page.goto(`/hedgerow/?sandbox=1&2d&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as { hedgerow?: Hg }).hedgerow?.game(), null, { timeout: 60_000 })
}

const meets = (a: R, b: R) => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1

for (const level of [21, 34]) {
  test(`level ${level}: every power on the dock is a labelled token`, async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, level)
    const powers = page.locator('.controls [data-power]:visible')
    const n = await powers.count()
    expect(n).toBeGreaterThanOrEqual(level >= 25 ? 3 : 2)
    const go = (await page.locator('#btn-send').boundingBox())!
    for (let i = 0; i < n; i++) {
      const p = powers.nth(i)
      const box = (await p.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      const label = p.locator('.ability-label')
      await expect(label).toBeVisible()
      await expect(label).not.toBeEmpty()
      const lb = (await label.boundingBox())!
      expect(lb.width, 'label not clipped away').toBeGreaterThan(10)
      expect(lb.x).toBeGreaterThanOrEqual(box.x - 1)
      expect(lb.x + lb.width).toBeLessThanOrEqual(box.x + box.width + 1)
      expect(parseFloat(await label.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(11)
      expect(meets(box, go), `${await p.getAttribute('data-power')} meets Go`).toBe(false)
    }
    const auto = page.locator('#btn-auto')
    await expect(auto).toHaveAttribute('aria-label', /Keep Going/i)
    const word = auto.locator('.auto-word')
    await expect(word).toBeVisible()
    expect(parseFloat(await word.evaluate((e) => getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(11)
    expect(meets((await auto.boundingBox())!, go)).toBe(false)
    const dock = page.locator('#cath-dock-line')
    if (await dock.isVisible()) {
      const d = (await dock.boundingBox())!
      for (let i = 0; i < n; i++) expect(meets((await powers.nth(i).boundingBox())!, d)).toBe(false)
      expect(meets((await auto.boundingBox())!, d)).toBe(false)
    }
  })
}
