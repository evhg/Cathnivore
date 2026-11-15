import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 414: Hollowell's face is its own style, not a player's. Graham Pell is drawn with no outline in the ink
// token (glossy plastic, hard highlights) and reads unlike Mara: over 40% of the pixels differ when both portraits
// are brought to one size. A new card on the conveyor lands on a synth blip, on a curve that never overshoots.

async function start(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
}

/** The fraction of pixels whose largest channel differs by over 48 (of 255), with both images drawn at 64x64. */
async function pixelDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([a64, b64]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
    const px = (img: HTMLImageElement) => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, 64, 64)
      return g.getImageData(0, 0, 64, 64).data
    }
    const [pa, pb] = [px(await load(`data:image/png;base64,${a64}`)), px(await load(`data:image/png;base64,${b64}`))]
    let n = 0
    for (let i = 0; i < pa.length; i += 4) if (Math.max(Math.abs(pa[i]! - pb[i]!), Math.abs(pa[i + 1]! - pb[i + 1]!), Math.abs(pa[i + 2]! - pb[i + 2]!)) > 48) n++
    return n / (pa.length / 4)
  }, [a.toString('base64'), b.toString('base64')] as const)
}

test('Pell is drawn in Hollowell\'s style and reads unlike Mara', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the phone shows both faces as portraits (the papers medallion and the counter bench)')
  await start(page)
  const pell = page.locator('.papers-placard-face svg').first()
  const mara = page.locator('[data-table-producer="mara"] svg').first()
  await expect(pell).toBeVisible()
  await expect(mara).toBeVisible()
  const ink = await page.evaluate(() => {
    const probe = document.createElement('i')
    probe.style.color = 'var(--ink)'
    document.body.append(probe)
    const c = getComputedStyle(probe).color
    probe.remove()
    return c
  })
  const strokes = await pell.evaluate((svg) => [...svg.querySelectorAll('*')].map((e) => getComputedStyle(e).stroke).filter((s) => s && s !== 'none'))
  expect(strokes).not.toContain(ink)
  expect(await pixelDiff(page, await pell.screenshot(), await mara.screenshot())).toBeGreaterThan(0.4)
})

test('a card moving onto the conveyor lands on a synth blip, without overshoot', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'the strip shows its cards at D')
  await page.addInitScript(() => {
    const w = window as unknown as { armed: string[] }
    w.armed = []
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement
        if (m.attributeName === 'data-arming' && el.hasAttribute('data-arming')) {
          const a = el.getAnimations()[0]
          w.armed.push(a ? String((a.effect as KeyframeEffect).getTiming().easing) : '')
        }
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-arming'] })
  })
  await start(page)
  const blips = () => page.evaluate(() => (window as unknown as { __cathnivoreSound: { log: string[] } }).__cathnivoreSound.log.filter((c) => c === 'synthBlip').length)
  const before = await blips()
  // End the round (Graft until the round turns): Hollowell plays its turn and the conveyor moves.
  const round = await page.locator('.plan-strip').getAttribute('data-round')
  for (let i = 0; i < 12 && (await page.locator('.plan-strip').getAttribute('data-round')) === round; i++) {
    const graft = page.getByRole('button', { name: /^Graft:/ })
    if (await graft.isVisible().catch(() => false)) await graft.click({ force: true }).catch(() => {})
    await page.waitForTimeout(400)
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as { armed: string[] }).armed.length), { timeout: 20_000 }).toBeGreaterThan(0)
  const easings = await page.evaluate(() => (window as unknown as { armed: string[] }).armed)
  for (const e of easings) {
    const m = e.match(/cubic-bezier\(([^)]+)\)/)
    if (m) for (const y of m[1]!.split(',').map(Number).filter((_, i) => i % 2 === 1)) expect(y, e).toBeLessThanOrEqual(1)
    else expect(e).toMatch(/^(linear|ease-in|ease-out|ease-in-out|ease)$/)
  }
  await expect.poll(blips, { timeout: 5_000 }).toBeGreaterThan(before)
})

// Plan item 414: his face answers the table at once: within 400 ms of a Squeeze he gloats (it is his win, so he
// gloats rather than rattles: logged in DECISIONS), and within 400 ms of a liberated region he is rattled.
test('Pell\'s face swaps within 400 ms of a Squeeze or a liberation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'his medallion sits at the table head at D')
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const rival = page.locator('[data-rival]')
  await expect(rival).toHaveAttribute('data-mood', 'smug')
  await page.waitForFunction(() => typeof (window as unknown as { cathnivoreMoment?: unknown }).cathnivoreMoment === 'function')
  for (const [kind, mood] of [['squeeze', 'gloat'], ['liberate', 'rattled']] as const) {
    const ms = await page.evaluate(([kind, mood]) => new Promise<number>((done) => {
      const el = document.querySelector('[data-rival]')!
      const t0 = performance.now()
      const check = () => (el.getAttribute('data-mood') === mood ? done(performance.now() - t0) : requestAnimationFrame(check))
      ;(window as unknown as { cathnivoreMoment: (k: string, r: string) => void }).cathnivoreMoment(kind, 'kingsmarket')
      check()
    }), [kind, mood] as const)
    expect(ms, kind).toBeLessThan(400)
  }
})
