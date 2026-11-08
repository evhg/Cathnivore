import { test, expect } from '@playwright/test'

// Plan item 150: each chapter card is a painted scene of its regions with its producer at a stall; a won chapter's
// scene is coloured in (the co-op's bunting and the sun's rays), a locked one waits at dusk under a wax seal (item 279).
test('chapter scenes: the producer at a stall, bunting once won, sealed while locked', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('cathnivore:campaign:v1', JSON.stringify({ version: 1, completed: ['fresh-meat'], tutorialDone: true })))
  await page.goto('/')
  await page.getByText('Campaign', { exact: false }).first().click()
  const arts = page.locator('[data-chapter-art]')
  await expect(arts.first()).toBeVisible()
  const states = await arts.evaluateAll((els) =>
    els.map((e) => ({
      state: (e as SVGElement).dataset.chapterArt,
      shapes: e.querySelectorAll('path, rect, circle, ellipse, polygon').length,
      stall: e.querySelectorAll('.cmp-vig-stall').length,
      bunting: e.querySelectorAll('.cmp-vig-bunting .cmp-vig-flag').length,
      sealed: e.classList.contains('is-sealed') && !!e.querySelector('.cmp-vig-seal'),
    })),
  )
  expect(states.length).toBe(6)
  expect(states.map((s) => s.state)).toEqual(['done', 'current', 'locked', 'locked', 'locked', 'locked'])
  for (const s of states) {
    expect(s.shapes).toBeGreaterThanOrEqual(5)
    expect(s.stall).toBe(1)
    expect(s.bunting).toBe(s.state === 'done' ? 7 : 0)
    expect(s.sealed).toBe(s.state === 'locked')
  }
})
