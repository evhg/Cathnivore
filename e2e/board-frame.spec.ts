import { test, expect, type Page } from '@playwright/test'

// Plan item 76 (a board that fills its frame and lives): at every size the whole of each hex, its raised edge
// included, sits inside the board's frame (.map-wrap), and the ambient motion (the mill's sails, the boat, gulls,
// reeds) runs normally and is parked under reduced motion.
async function startGame(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.map-wrap svg.map .region-hex').first().waitFor()
  await page.waitForTimeout(600)
}

const ambientCount = (page: Page) =>
  page.evaluate(
    () =>
      Array.from(document.querySelectorAll('.map-wrap svg.map [class^="amb-"]')).filter((el) =>
        el.getAnimations().some((a) => a.playState === 'running'),
      ).length,
  )

for (const size of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
])
  test(`every hex sits inside the board's frame at ${size.width}x${size.height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'sizes set here')
    await page.setViewportSize(size)
    await startGame(page)
    const out = await page.evaluate(() => {
      const wrap = document.querySelector('.map-wrap')!.getBoundingClientRect()
      const bad: string[] = []
      let n = 0
      for (const sel of ['.region-hex > polygon', '.tile-edges polygon']) {
        for (const el of Array.from(document.querySelectorAll<SVGGraphicsElement>(`.map-wrap svg.map ${sel}`))) {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          n++
          if (r.left < wrap.left - 0.5 || r.right > wrap.right + 0.5 || r.top < wrap.top - 0.5 || r.bottom > wrap.bottom + 0.5)
            bad.push(`${sel} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)} in ${Math.round(wrap.right)}x${Math.round(wrap.bottom)}`)
        }
      }
      return { bad, n }
    })
    expect(out.bad).toEqual([])
    expect(out.n, 'faces and edges measured').toBeGreaterThanOrEqual(14)
  })

test('the board has ambient motion, parked under reduced motion', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'one browser is enough')
  await page.setViewportSize({ width: 1440, height: 900 })
  await startGame(page)
  expect(await ambientCount(page)).toBeGreaterThanOrEqual(3)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(100)
  expect(await ambientCount(page)).toBe(0)
})
