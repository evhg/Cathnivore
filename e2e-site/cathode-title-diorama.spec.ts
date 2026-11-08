import { expect, test, type Page } from './own-gpu'

// Plan item 283: the title street as a lit diorama. On an upright phone the menu stays clear of her body; the
// wordmark (and the class pick's header on a phone) keeps 4.5:1 against whatever the street puts behind it.

test.setTimeout(180_000)

type Box = { left: number; top: number; right: number; bottom: number }
type Front = { cathodeFront?: { ready: boolean; scene?: () => { figureBox(body?: boolean): Box } | null } }

async function open(page: Page, q = ''): Promise<void> {
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
  await page.goto(`/nightshift/?shot&t=8${q}`)
  await page.waitForFunction(() => !!(window as unknown as Front).cathodeFront?.scene?.(), null, { timeout: 120_000 })
  // Automated runs draw once every 3 s: let the framing settle on the measured figure.
  await page.waitForTimeout(4000)
}

/** The contrast of `ink` against the brightest 5% of what is behind `sel`, with `sel`'s own text hidden. */
async function contrastBehind(page: Page, sel: string): Promise<number> {
  const box = await page.locator(sel).first().boundingBox()
  expect(box).not.toBeNull()
  const ink = await page.locator(sel).first().evaluate((e) => getComputedStyle(e).color)
  await page.addStyleTag({ content: `${sel}, ${sel} * { color: transparent !important; -webkit-text-stroke: 0 !important; text-shadow: none !important; fill: transparent !important; stroke: transparent !important; }` })
  await page.waitForTimeout(200)
  const shot = await page.screenshot({ clip: box! })
  return page.evaluate(
    async ({ b64, ink }) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = new OffscreenCanvas(img.width, img.height)
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0)
      const d = g.getImageData(0, 0, img.width, img.height).data
      const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      const L = (r: number, gg: number, b: number) => 0.2126 * lin(r / 255) + 0.7152 * lin(gg / 255) + 0.0722 * lin(b / 255)
      const ys: number[] = []
      for (let i = 0; i < d.length; i += 4) ys.push(L(d[i]!, d[i + 1]!, d[i + 2]!))
      ys.sort((a, b) => a - b)
      const bg = ys[Math.floor(ys.length * 0.95)]!
      const m = ink.match(/[\d.]+/g)!.map(Number)
      const fg = L(m[0]!, m[1]!, m[2]!)
      return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
    },
    { b64: shot.toString('base64'), ink },
  )
}

test('the title wordmark keeps 4.5:1 over the dressed street', async ({ page }) => {
  await open(page)
  expect(await contrastBehind(page, '.logo')).toBeGreaterThanOrEqual(4.5)
})

test('on an upright phone the title menu stays clear of her body', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 700, 'upright phone only')
  await open(page)
  const menu = (await page.locator('.menu').boundingBox())!
  const fig = await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene!()!.figureBox(true))
  const overlapX = Math.min(menu.x + menu.width, fig.right) - Math.max(menu.x, fig.left)
  const overlapY = Math.min(menu.y + menu.height, fig.bottom) - Math.max(menu.y, fig.top)
  expect(overlapX <= 0 || overlapY <= 0, `menu ${JSON.stringify(menu)} vs her ${JSON.stringify(fig)}`).toBe(true)
})

test('on an upright phone the class pick header keeps 4.5:1 over the street sign', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 700, 'upright phone only')
  await open(page, '&front=classpick&class=ghost')
  await expect(page.locator('.cp-head')).toBeVisible()
  expect(await contrastBehind(page, '.cp-title')).toBeGreaterThanOrEqual(4.5)
  expect(await contrastBehind(page, '.cp-eyebrow')).toBeGreaterThanOrEqual(4.5)
})
