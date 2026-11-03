import { test, expect, type Page } from '@playwright/test'

// Plan item 53: a table that sounds like a market. Every cue renders offline to audible sound under 1.2 s that
// peaks below -3 dBFS; with sound off no AudioContext is made; with it on, autoplay schedules cues as it plays.
type Snd = { log: string[]; cues: string[]; hasContext(): boolean; measure(c: string): Promise<{ peak: number; rms: number; lastSound: number }> }
const snd = (page: Page) => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.cues)

test('every cue renders offline: audible, under 1.2 s, peak under -3 dBFS', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as unknown as { __cathnivoreSound?: Snd }).__cathnivoreSound)
  const cues = await snd(page)
  expect(cues.length).toBeGreaterThanOrEqual(15)
  for (const cue of cues) {
    const m = await page.evaluate((c) => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.measure(c), cue)
    expect(m.peak, cue).toBeGreaterThan(0.02)
    expect(m.peak, cue).toBeLessThan(0.708)
    expect(m.lastSound, cue).toBeLessThan(1.2)
  }
})

async function quickGame(page: Page, sound: boolean): Promise<void> {
  await page.goto('/')
  await page.evaluate((on) => {
    const k = 'cathnivore:settings:v1'
    const s = JSON.parse(localStorage.getItem(k) ?? '{}')
    localStorage.setItem(k, JSON.stringify({ version: 1, ...s, sound: on }))
  }, sound)
  await page.goto('/?e2eAutoplay=1&e2eAutoplayUntil=2')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
}

test('with sound off, no AudioContext is made, even after taps', async ({ page }) => {
  await quickGame(page, false)
  await page.waitForTimeout(3000)
  expect(await page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.hasContext())).toBe(false)
  expect(await page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.log.length)).toBe(0)
})

test('with sound on, a round of autoplay schedules table and Hollowell cues', async ({ page }) => {
  await quickGame(page, true)
  // The first tap made the context; autoplay's actions now schedule cues.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.log.length), { timeout: 60_000 }).toBeGreaterThan(5)
  const log = await page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.log)
  expect(log.some((c) => !c.startsWith('synth'))).toBe(true)
  // Round 2 opens with the market bell.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.log.includes('bell')), { timeout: 60_000 }).toBe(true)
})
