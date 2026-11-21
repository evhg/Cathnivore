import { expect, test, type Page } from '@playwright/test'

// Plan item 399: each act's field furnished as its own country. Saltmarsh (21) and Rivermead (34) sow their plots
// from their own kits, so the plots' mean hue differs by 15 degrees or more (it was the one farm kit everywhere).
type Hook = { hedgerow?: { game(): unknown; plotLooks(): Array<[string, string]>; cellCenter(c: number, r: number): { x: number; y: number } | null } }

async function open(page: Page, level: number): Promise<void> {
  await page.goto('/hedgerow/?2d&sandbox=1')
  await page.evaluate((l) => localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: {}, seenBefore: { [String(l)]: true }, seen: {}, tips: {} })), level)
  await page.goto(`/hedgerow/?2d&sandbox=1&level=${level}`)
  await page.waitForFunction(() => !!(window as unknown as Hook).hedgerow?.game(), null, { timeout: 30000 })
  await page.waitForTimeout(800)
}

/** The saturation-weighted circular mean hue of the plots' inner halves, from a screenshot of the page. */
async function plotHue(page: Page): Promise<{ hue: number; looks: string[] }> {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(async (b64) => {
    const h = (window as unknown as Hook).hedgerow!
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const cv = document.createElement('canvas')
    cv.width = img.width
    cv.height = img.height
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const dpr = img.width / innerWidth
    const looks = h.plotLooks()
    const a = h.cellCenter(0, 0)!, b = h.cellCenter(1, 0)!
    const cell = Math.abs(b.x - a.x)
    // Plan item 611: on a phone Cath's line rises over the field's foot; the plots under it are her bubble, not beds
    const over = [...document.querySelectorAll('#cath-dock-line, #cath-say')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    let sx = 0, sy = 0
    for (const [k] of looks) {
      const [c, r] = k.split(',').map(Number) as [number, number]
      const p = h.cellCenter(c, r)!
      if (over.some((o) => p.x + cell / 2 > o.left && p.x - cell / 2 < o.right && p.y + cell / 2 > o.top && p.y - cell / 2 < o.bottom)) continue
      const x0 = Math.round((p.x - cell * 0.25) * dpr), y0 = Math.round((p.y - cell * 0.25) * dpr)
      const n = Math.max(1, Math.round(cell * 0.5 * dpr))
      const d = ctx.getImageData(x0, y0, n, n).data
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i]! / 255, G = d[i + 1]! / 255, B = d[i + 2]! / 255
        const max = Math.max(R, G, B), min = Math.min(R, G, B), l = (max + min) / 2
        if (max === min) continue
        const s = (max - min) / (1 - Math.abs(2 * l - 1))
        let hh = max === R ? ((G - B) / (max - min)) % 6 : max === G ? (B - R) / (max - min) + 2 : (R - G) / (max - min) + 4
        hh *= 60
        sx += s * Math.cos((hh * Math.PI) / 180)
        sy += s * Math.sin((hh * Math.PI) / 180)
      }
    }
    return { hue: ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360, looks: [...new Set(looks.map(([, l]) => l))].sort() }
  }, shot)
}

test('plan item 399: Saltmarsh and Rivermead sow their own beds, and their plots differ in hue by 15 degrees or more', async ({ page }) => {
  await open(page, 21)
  const salt = await plotHue(page)
  await open(page, 34)
  const river = await plotHue(page)
  expect(salt.looks).toEqual(['lavender', 'saltgrass', 'samphire'])
  expect(river.looks).toEqual(['cress', 'meadow', 'swathe'])
  let gap = Math.abs(salt.hue - river.hue)
  if (gap > 180) gap = 360 - gap
  console.log(`hue l21 ${salt.hue.toFixed(1)} l34 ${river.hue.toFixed(1)} gap ${gap.toFixed(1)}`)
  expect(gap).toBeGreaterThanOrEqual(15)
})
