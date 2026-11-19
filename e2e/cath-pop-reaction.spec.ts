import { test, expect, type Page } from '@playwright/test'
import { fillSeed } from './setupSeed'

// Plan item 519: on an upright phone Cath reacts over the board: at a Squeeze and at a purchase her figure pops up over
// the board's corner (item 276's `.cath-pop`), 110 px or taller, wearing the reaction's expression within 300 ms.
async function start(page: Page, url: string, seed?: string): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(url)
  await page.getByText('Quick Game').click()
  if (seed) await fillSeed(page, seed)
  await page.locator('.setup-start').click()
  await page.locator('.game .map .tile-edges').waitFor()
  await page.waitForTimeout(600)
}

// From the call to the pop showing the expression, timed in the page.
async function popAfter(page: Page, act: string, want: string): Promise<{ ms: number; h: number; pose: string | null }> {
  return page.evaluate(
    async ([act, want]) => {
      const t0 = performance.now()
      if (act === 'squeeze') {
        const id = document.querySelectorAll('.region-hex')[3]!.getAttribute('data-region')!
        ;(window as unknown as { cathnivoreMoment(k: string, id: string): void }).cathnivoreMoment('squeeze', id)
      } else {
        const card = [...document.querySelectorAll<HTMLElement>('[data-hand-card]')].find((c) => /^Buy /.test(c.textContent ?? ''))
        if (!card) throw new Error('no Buy card: ' + [...document.querySelectorAll('[data-hand-card]')].map((c) => c.textContent).join(' | '))
        card.querySelector<HTMLElement>('button')!.click()
      }
      let pop: HTMLElement | null = null
      while (performance.now() - t0 < 2000) {
        pop = document.querySelector<HTMLElement>(`.cath-pop[data-expression="${want}"]`)
        if (pop) break
        await new Promise((r) => requestAnimationFrame(r))
      }
      const ms = performance.now() - t0
      // her full height once risen (the rise is a translate, not a size change)
      return { ms, h: pop?.getBoundingClientRect().height ?? 0, pose: pop?.dataset.pose ?? null }
    },
    [act, want] as const,
  )
}

test('phone: a Squeeze pops Cath up over the board, worried, within 300 ms', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  await start(page, '/?e2eMoment=1')
  const r = await popAfter(page, 'squeeze', 'worried')
  expect(r.pose).toBe('thinking')
  expect(r.ms).toBeLessThanOrEqual(300)
  expect(r.h).toBeGreaterThanOrEqual(110)
})

test('phone: a purchase pops Cath up over the board, delighted, within 300 ms', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the upright phone')
  // the Setup's seed 7 deals Buy Roadside Stand into the first hand (a seed in the URL does not fix the deal)
  await start(page, '/', '7')
  // it is offered once the opening harvest has landed the Marks that pay for it
  await page.locator('[data-hand-card]', { hasText: /^Buy / }).first().waitFor({ state: 'attached', timeout: 10_000 })
  const r = await popAfter(page, 'buy', 'delighted')
  expect(r.pose).toBe('point')
  expect(r.ms).toBeLessThanOrEqual(300)
  expect(r.h).toBeGreaterThanOrEqual(110)
  // and, risen, she stands inside the board's frame, over its corner, not over the hand
  await page.waitForTimeout(700)
  const pop = (await page.locator('.cath-pop').boundingBox())!
  const frame = (await page.locator('.map-wrap').boundingBox())!
  expect(pop.y + pop.height).toBeLessThanOrEqual(frame.y + frame.height + 1)
  // standing on her counter (the frame's near edge), whole above it, not behind it
  const dock = (await page.locator('.map-wrap .cath-dock').boundingBox())!
  expect(pop.y + pop.height).toBeLessThanOrEqual(dock.y + 2)
})
