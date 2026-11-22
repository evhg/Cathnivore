import { expect, test } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 541: on a 390x844 phone the playable cards are the held fan (item 405), every one in view at rest; the
// lifted card's 'i' and Sell's coins answer a finger 44 px tall (the 'i' a 26 px dot in a 44 px target, the coins
// 28 px meeting their neighbours halfway); Sell's gain chip stays clear of its name.
test('phone: the held fan stands apart and its small controls take a 44 px finger', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'the held fan is the phone layout')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?e2eHandFan=1')
  await page.getByText('Quick Game').click()
  await fillSeed(page, '7')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.action-tray .actions[data-fan]').waitFor()
  await page.waitForTimeout(800)

  const fan = await page.evaluate(() =>
    [...document.querySelectorAll('.action-tray .actions[data-fan] > .action-item[data-fan]')].map((c) => {
      const r = c.getBoundingClientRect()
      return { l: r.left, r: r.right }
    }),
  )
  expect(fan.length).toBeGreaterThan(2)
  // Plan item 635 (was item 541's whole fan in view): the cards stand whole and apart, three or more in view, the
  // rest a swipe away; none lies over another
  expect(fan.filter((c) => c.l >= -1 && c.r <= 391).length).toBeGreaterThanOrEqual(3)
  const byLeft = [...fan].sort((a, b) => a.l - b.l)
  for (let i = 1; i < byLeft.length; i++) expect(byLeft[i]!.l).toBeGreaterThanOrEqual(byLeft[i - 1]!.r - 6)

  // lift Sell (a tap on its strip), then probe its coins and its 'i' 20 px above and below their centres
  const sell = page.locator('.action-tray .action-item.action-sell')
  const box = (await sell.boundingBox())!
  await page.mouse.click(box.x + 8, box.y + 40)
  await expect(sell).toHaveAttribute('data-lifted', '')
  await page.waitForTimeout(400)
  const probe = await page.evaluate(() => {
    const card = document.querySelector('.action-tray .action-item.action-sell')!
    const hits = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      return [cy - 20, cy + 20].every((y) => el.contains(document.elementFromPoint(cx, y)))
    }
    const coins = [...card.querySelectorAll('.sell-count-pip:not(:disabled)')]
    const chip = card.querySelector('.action-cost')!.getBoundingClientRect()
    const label = card.querySelector('.action-label')!
    const range = document.createRange()
    range.selectNodeContents(label)
    const text = [...range.getClientRects()].filter((r) => r.width > 10).at(-1)!
    return {
      coins: coins.map(hits),
      size: coins.map((c) => c.getBoundingClientRect().width),
      info: hits(card.querySelector('.tooltip-trigger-button')!),
      gap: text.top - chip.bottom,
    }
  })
  expect(probe.coins.length).toBeGreaterThan(0)
  for (const h of probe.coins) expect(h, 'a coin answers 20 px above and below its centre').toBe(true)
  for (const w of probe.size) expect(w).toBeGreaterThanOrEqual(28)
  expect(probe.info, "the 'i' answers 20 px above and below its centre").toBe(true)
  expect(probe.gap, "Sell's chip clear of its name").toBeGreaterThanOrEqual(0)
})
