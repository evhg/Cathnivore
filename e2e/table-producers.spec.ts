import { test, expect } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 155: both producers sit at the table inside the map frame, opposite Cath: 160 px or taller at 1440x900,
// 64 px or taller on a phone, meeting no hex or name plaque. A Squeeze on a region where one has a Stall worries them.
test('the producers are seated at the table, and a Squeeze worries them', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  const phone = testInfo.project.name === 'phone'
  if (!phone) await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/?e2eMoment=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const people = page.locator('.map-wrap [data-table-producer]')
  await expect(people).toHaveCount(2)
  await expect(people.nth(1)).toBeVisible()
  await page.waitForTimeout(400)
  const wrap = (await page.locator('.map-wrap').boundingBox())!
  const blockers = await page.evaluate(() =>
    [
      ...[...document.querySelectorAll('.region-hex')].map((h) => h.querySelector('polygon')!.getBoundingClientRect()),
      ...[...document.querySelectorAll('.region-plaque')].map((p) => p.getBoundingClientRect()),
    ].map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height })),
  )
  for (const person of await people.all()) {
    if (!phone) break // a desktop table stands them half length: the next test checks it
    const b = (await person.boundingBox())!
    const id = await person.getAttribute('data-table-producer')
    expect(b.height, `${id} height`).toBeGreaterThanOrEqual(64)
    expect(b.x).toBeGreaterThanOrEqual(wrap.x - 1)
    expect(b.y).toBeGreaterThanOrEqual(wrap.y - 5)
    expect(b.x + b.width).toBeLessThanOrEqual(wrap.x + wrap.width + 1)
    expect(b.y + b.height).toBeLessThanOrEqual(wrap.y + wrap.height + 1)
    for (const o of blockers) {
      const meets = b.x < o.x + o.width && o.x < b.x + b.width && b.y < o.y + o.height && o.y < b.y + b.height
      expect(meets, `${id} meets a hex or plaque`).toBe(false)
    }
  }
  // A Squeeze on each region in turn until one lands on a Stall: that producer's face turns worried.
  await expect(people.first()).toHaveAttribute('data-expression', 'neutral')
  const regions = await page.locator('.region-hex').evaluateAll((els) => els.map((e) => e.getAttribute('data-region')!))
  let worried = false
  for (const region of regions) {
    await page.evaluate((r) => (window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment('squeeze', r), region)
    await page.waitForTimeout(150)
    if ((await page.locator('.map-wrap [data-table-producer][data-expression="worried"]').count()) > 0) {
      worried = true
      break
    }
  }
  expect(worried, 'a Squeeze on a Stall worries its producer').toBe(true)
  // A liberation there delights its first Stall-holder, once the worry has passed.
  await page.waitForTimeout(200)
  const delighted = await page.evaluate(async (regions) => {
    for (const r of regions) {
      ;(window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment('liberate', r)
      await new Promise((res) => setTimeout(res, 150))
      if (document.querySelector('.map-wrap [data-table-producer][data-expression="delighted"]')) return true
    }
    return false
  }, regions)
  expect(delighted, 'a liberation delights a producer with a Stall there').toBe(true)
})

// Plan item 374: at a desktop table each seat is named on a plate in its producer's colour (13 px+, 4.5:1), and
// exactly one seat, the producer whose turn it is, is marked active.
test('the seated producers are named, and the active seat matches the turn', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'D only')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  const plates = page.locator('.map-wrap .table-producer-name')
  await expect(plates).toHaveCount(2)
  await expect(page.locator('.map-wrap [data-table-producer][data-active]')).toHaveCount(1)
  const active = await page.locator('.map-wrap [data-table-producer][data-active]').getAttribute('data-table-producer')
  await expect(page.locator(`.map-wrap [data-table-producer="${active}"] .table-producer-name`)).toBeVisible()
  const looks = await plates.evaluateAll((els) =>
    els.map((e) => {
      const cs = getComputedStyle(e)
      const rgb = (c: string) => {
        const k = document.createElement('canvas').getContext('2d')!
        k.fillStyle = c
        k.fillRect(0, 0, 1, 1)
        return [...k.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
      }
      const a = lum(rgb(cs.color))
      const b = lum(rgb(cs.backgroundColor))
      return { text: e.textContent, fs: parseFloat(cs.fontSize), contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) }
    }),
  )
  for (const l of looks) {
    expect(l.fs, `${l.text} size`).toBeGreaterThanOrEqual(13)
    expect(l.contrast, `${l.text} contrast`).toBeGreaterThanOrEqual(4.5)
  }
})

// Plan item 374: at a desktop table they stand half length at Cath's scale behind the far rim: each figure 80%+ of her
// drawn height at 1440x900 and 1280x800, their drawn parts (head, torso and arms; a held prop may cross an edge) meeting no hex, name plaque, the
// event ticket or the map key, and every name plate inside the frame.
for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`the producers stand at Cath's scale at ${width}x${height}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'D only')
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await page.getByText('Quick Game').click()
    await fillSeed(page, '7')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.map-wrap [data-table-producer]:not([data-unseated]) svg.fig')).toHaveCount(2)
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => {
      const box = (e: Element) => {
        const r = e.getBoundingClientRect()
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
      }
      const wrap = document.querySelector('.map-wrap')!
      return {
        wrap: box(wrap),
        cathH: document.querySelector('.table-cath-figure svg')!.getBoundingClientRect().height,
        people: [...wrap.querySelectorAll('[data-table-producer]')].map((p) => ({
          id: p.getAttribute('data-table-producer')!,
          h: p.querySelector('svg.fig')!.getBoundingClientRect().height,
          parts: [box(p.querySelector('.fig-head')!), ...[...p.querySelectorAll('.fig-body > path')].map(box)],
          plate: box(p.querySelector('.table-producer-name')!),
        })),
        blockers: [
          ...[...wrap.querySelectorAll('.region-hex')].map((h) => box(h.querySelector('polygon')!)),
          ...[...wrap.querySelectorAll('.region-plaque, .event-ticket, .map-key')].map(box),
        ],
      }
    })
    for (const p of m.people) {
      expect(p.h / m.cathH, `${p.id} at Cath's scale`).toBeGreaterThanOrEqual(0.8)
      for (const part of p.parts)
        for (const o of m.blockers) {
          const meets = part.left < o.right && o.left < part.right && part.top < o.bottom && o.top < part.bottom
          expect(meets, `${p.id} meets ${JSON.stringify(o)}`).toBe(false)
        }
      expect(p.plate.left, `${p.id} plate in the frame`).toBeGreaterThanOrEqual(m.wrap.left)
      expect(p.plate.right).toBeLessThanOrEqual(m.wrap.right)
      expect(p.plate.bottom).toBeLessThanOrEqual(m.wrap.bottom)
    }
  })
}
