import { expect, test, type Page } from '@playwright/test'

// Plan item 112: the class pick shows Cath's face. A `?play` link on a fresh save builds the street behind the
// case file and turns her to the camera in each class's look; the stats sit on a dark dossier plate; on an
// upright phone the names are 15 px and (plan item 125) the whole file fits one screen.

type Box = { left: number; top: number; right: number; bottom: number }
type Front = { cathodeFront?: { ready: boolean; scene: () => { dressed: string | null; kit: string | null; figureBox(): Box } | null } }

const CLASSES = ['ghost', 'butcher', 'gunslinger', 'wirewitch', 'fixer']

async function fresh(page: Page, hasTouch: boolean): Promise<void> {
  await page.setViewportSize(hasTouch ? { width: 390, height: 844 } : { width: 1440, height: 900 })
  await page.goto('/nightshift/?shot')
  await page.evaluate(() => {
    localStorage.clear()
    localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' }))
  })
}

test('a ?play case file turns Cath to the camera, in a different look for each class', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  const dressed = () => page.evaluate(() => (window as unknown as Front).cathodeFront?.scene()?.dressed ?? null)
  await expect.poll(dressed, { timeout: 200_000 }).toBe('ghost')
  const seen = new Set<string>()
  for (const cls of CLASSES) {
    await page.locator(`.cp-opt[data-cls=${cls}]`).click()
    await expect.poll(dressed, { timeout: 30_000 }).toBe(cls)
    // Each class's own kit over the coat (the rifle sling, the apron, the holster, the wire rig, the tie).
    seen.add(`${await dressed()}/${await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene()!.kit)}`)
  }
  expect([...seen]).toEqual(CLASSES.map((c) => `${c}/${c}`))
  // Her figure, head to hem, is a presence: 420 px or more at D, 300 at P.
  const fig = await page.evaluate(() => (window as unknown as Front).cathodeFront!.scene()!.figureBox())
  expect(fig.bottom - fig.top, JSON.stringify(fig)).toBeGreaterThanOrEqual(hasTouch ? 300 : 420)
})

test('the stat sheet reads at 4.5:1 on its plate; the phone names are 15 px and the file fits one screen', async ({ page, hasTouch }) => {
  test.setTimeout(300_000)
  await fresh(page, hasTouch)
  await page.goto('/nightshift/?front=classpick&shot&t=8&class=ghost&rs=0.5')
  await page.waitForFunction(() => (window as unknown as Front).cathodeFront?.ready === true, null, { timeout: 150_000 })
  await expect(page.locator('.cp-weapon-art svg')).toHaveCount(1)
  const box = (await page.locator('.cp-attrs').boundingBox())!
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.cp-attr dt')!).color)
  await page.addStyleTag({ content: '.cp-attrs { visibility: hidden !important; }' })
  const png = (await page.screenshot({ clip: box })).toString('base64')
  const ratio = await page.evaluate(async ([png, fill]) => {
    const img = new Image()
    img.src = `data:image/png;base64,${png}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    const x = c.getContext('2d')!
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const lin = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
    const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const ls: number[] = []
    for (let i = 0; i < d.length; i += 4) ls.push(lum(d[i]!, d[i + 1]!, d[i + 2]!))
    ls.sort((a, b) => a - b)
    const bg = ls[Math.floor(ls.length * 0.95)]!
    const [r, g, b] = fill.match(/\d+/g)!.map(Number)
    return (lum(r!, g!, b!) + 0.05) / (bg + 0.05)
  }, [png, ink] as const)
  expect(ratio).toBeGreaterThanOrEqual(4.5)
  await page.addStyleTag({ content: '.cp-attrs { visibility: visible !important; }' })
  if (!hasTouch) return
  // The names: 14 px or more, none overlapping another.
  const names = await page.locator('.cp-opt-name').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect()
      return { size: parseFloat(getComputedStyle(e).fontSize), left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    }),
  )
  for (const n of names) expect(n.size).toBeGreaterThanOrEqual(14)
  for (let i = 1; i < names.length; i++) expect(names[i]!.left).toBeGreaterThanOrEqual(names[i - 1]!.right)
  // Plan item 125: the whole file is one screen at 390x844 and 375x667: every stat, the weapon and the hold bar
  // inside the viewport with no scroll, text 12 px or more; her quote unfolds behind a tap.
  for (const size of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(size)
    await page.waitForTimeout(400)
    const m = await page.evaluate(() => {
      const cp = document.querySelector('.cp')!
      const box = (s: string) => {
        const r = document.querySelector(s)!.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width }
      }
      const small = [...cp.querySelectorAll<HTMLElement>('*')]
        .filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
        .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12)
        .map((e) => e.className)
      return { scroll: cp.scrollHeight - cp.clientHeight, small, attrs: box('.cp-attrs'), weapon: box('.cp-weapon'), art: box('.cp-weapon-art'), hold: box('.cp-hold'), n: document.querySelectorAll('.cp-attr').length }
    })
    const s = JSON.stringify({ size, m })
    expect(m.scroll, s).toBeLessThanOrEqual(0)
    expect(m.small, s).toEqual([])
    expect(m.n).toBe(4)
    for (const b of [m.attrs, m.weapon, m.hold]) expect(b.top >= 0 && b.bottom <= size.height && b.left >= 0 && b.right <= size.width, s).toBe(true)
    expect(m.art.bottom - m.art.top, s).toBeGreaterThanOrEqual(44)
    expect(m.hold.w, s).toBeGreaterThan(size.width - 40)
    await expect(page.locator('.cp-line')).toBeHidden()
  }
  await page.locator('.cp-fold').click()
  await expect(page.locator('.cp-fold')).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.cp-line')).toBeVisible()
  const hold = (await page.locator('.cp-hold').boundingBox())!
  expect(hold.y + hold.height).toBeLessThanOrEqual(667)
})

// Plan item 117: on the class pick at D her face is in the frame and not under the stats sheet.
test('the class pick shows her face clear of the stats sheet', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'the desktop class pick')
  test.setTimeout(300_000)
  await fresh(page, false)
  await page.goto('/nightshift/?play&rs=0.5')
  await expect(page.locator('.cp')).toBeVisible({ timeout: 60_000 })
  type F = { cathodeFront?: { scene: () => { dressed: string | null; faceBox(): Box } | null } }
  await expect.poll(() => page.evaluate(() => (window as unknown as F).cathodeFront?.scene()?.dressed ?? null), { timeout: 200_000 }).toBe('ghost')
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => {
    const r = document.querySelector('.cp-sheet')!.getBoundingClientRect()
    return { face: (window as unknown as F).cathodeFront!.scene()!.faceBox(), sheet: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }
  })
  const { face, sheet } = m
  expect(face.top >= 0 && face.left >= 0 && face.right <= 1440 && face.bottom <= 900, JSON.stringify(m)).toBe(true)
  expect(face.left < sheet.right && face.right > sheet.left && face.top < sheet.bottom && face.bottom > sheet.top, JSON.stringify(m)).toBe(false)
})
