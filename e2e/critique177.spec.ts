import { test, expect, type Page } from '@playwright/test'

// Plan item 177: the Cathnivore points of the 2026-11-05 18:30 critique (`plan1105f`).
async function start(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.mouse.move(1, 1)
  await page.waitForTimeout(800)
}

test('desktop hand: no card name runs off its face or lies under another card', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1240, 'the hand is a desktop layout')
  await start(page)
  const bad = await page.evaluate(() => {
    const out: string[] = []
    const cards = [...document.querySelectorAll<HTMLElement>('.table-hand .action-item')]
    cards.forEach((c, i) => {
      const face = c.querySelector<HTMLElement>(':scope > button:first-child, .action-card-draggable')
      if (face && face.scrollHeight > face.clientHeight + 1) out.push(`${c.textContent} runs off its face`)
      const name = c.querySelector('.action-label')?.getBoundingClientRect()
      if (!name) return
      // Later cards paint over earlier ones (a hover lifts one; the pointer is parked off the hand).
      for (const o of cards.slice(i + 1)) {
        const r = o.getBoundingClientRect()
        const w = Math.min(name.right, r.right) - Math.max(name.left, r.left)
        const h = Math.min(name.bottom, r.bottom) - Math.max(name.top, r.top)
        if (w > 3 && h > 3) out.push(`${c.textContent} under ${o.textContent} (${w.toFixed(0)}x${h.toFixed(0)})`)
      }
    })
    return out
  })
  expect(bad).toEqual([])
})

test("the 'Not yet' shelf's reasons read at 4.5:1 or more", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1240, 'the shelf is the desktop rail')
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await start(page)
    const worst = await page.evaluate(() => {
      const lum = (rgb: number[]) => {
        const c = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
      }
      // Resolve any CSS colour to sRGB 0-1 through a canvas.
      const ctx = document.createElement('canvas').getContext('2d')!
      const rgb = (css: string) => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = css
        ctx.fillRect(0, 0, 1, 1)
        return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((v) => v / 255)
      }
      let min = Infinity
      for (const el of document.querySelectorAll<HTMLElement>('.actions .action-head-later ~ .action-item .action-why-not')) {
        let e: HTMLElement | null = el
        let bg = 'rgba(0, 0, 0, 0)'
        while (e && (bg = getComputedStyle(e).backgroundColor) === 'rgba(0, 0, 0, 0)') e = e.parentElement
        const a = lum(rgb(getComputedStyle(el).color))
        const b = lum(rgb(bg))
        min = Math.min(min, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05))
      }
      return min
    })
    if (worst !== Infinity) expect(worst, scheme).toBeGreaterThanOrEqual(4.5)
  }
})

test("the phone tray's section tabs read at 12 px or more", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) >= 1024, 'the tray is the phone layout')
  await start(page)
  const sizes = await page.evaluate(() => [...document.querySelectorAll('.action-tray .action-head')].map((h) => parseFloat(getComputedStyle(h).fontSize)))
  for (const s of sizes) expect(s).toBeGreaterThanOrEqual(12)
})
