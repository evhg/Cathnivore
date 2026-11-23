import { expect, test, type Page } from '@playwright/test'

// Plan item 663: on the act map Cath is a token with her portrait, 120 px or taller at D and 72 or taller on a phone;
// each played stop shows its stars in the DOM, a locked one none.
async function seed(page: Page, stars: Record<string, number>): Promise<void> {
  await page.goto('/hedgerow/?2d')
  await page.evaluate((st) => {
    const seenBefore = Object.fromEntries(Object.keys(st).map((k) => [k, true]))
    localStorage.setItem('hedgerow:v1', JSON.stringify({ version: 3, stars: st, seenBefore, seen: {}, tips: {}, bank: {} }))
  }, stars)
  await page.reload()
  await expect(page.locator('button.node.next')).toBeVisible()
}

test('plan item 663: Cath is a portrait token on her stop, and played stops show their stars', async ({ page }, testInfo) => {
  const phone = testInfo.project.name === 'site-phone'
  if (!phone) await page.setViewportSize({ width: 1440, height: 900 })
  const stars: Record<string, number> = {}
  for (let i = 1; i <= 24; i++) stars[String(i)] = 1 + (i % 3)
  await seed(page, stars)
  await page.waitForTimeout(800)
  const m = await page.evaluate(() => {
    const you = document.querySelector<HTMLElement>('#screen-select .node.next .you')!
    const act = you.closest('li.act')!
    const played = [...act.querySelectorAll<HTMLElement>('button.node.cleared')].map((b) => ({
      want: Number(b.dataset.stars),
      shown: (b.querySelector('.level-stars')?.textContent ?? '').replace(/[^★]/g, '').length,
      label: b.getAttribute('aria-label') ?? '',
    }))
    const locked = [...act.querySelectorAll<HTMLElement>('button.node:disabled .level-stars')].filter((e) => !e.hidden && e.textContent).length
    return {
      h: you.getBoundingClientRect().height,
      portrait: !!you.querySelector('svg.you-pin svg.cath[data-framing="bust"]'),
      next: you.closest('button.node')!.getAttribute('data-level'),
      played,
      locked,
    }
  })
  expect(m.next).toBe('25')
  expect(m.portrait).toBe(true)
  expect(m.h).toBeGreaterThanOrEqual(phone ? 72 : 120)
  expect(m.played.length).toBe(4)
  for (const p of m.played) {
    expect(p.shown).toBe(p.want)
    expect(p.label).toContain(`${p.want} of 3 stars`)
  }
  expect(m.locked).toBe(0)
})
