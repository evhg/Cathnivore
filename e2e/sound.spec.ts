import { test, expect, type Page } from '@playwright/test'

// Plan item 53: a table that sounds like a market. Every cue renders offline to audible sound under 1.2 s that
// peaks below -3 dBFS; with sound off no AudioContext is made; with it on, autoplay schedules cues as it plays.
type Snd = {
  log: string[]
  cues: string[]
  hasContext(): boolean
  playing(): boolean
  scoreMode(): string
  measure(c: string): Promise<{ peak: number; rms: number; lastSound: number }>
  measureScore(bars: number, mode: string, round: number): Promise<{ peak: number; rms: number }>
}
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

test("Hollowell's cues play on the enemy turn's playback beats", async ({ page }) => {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  const log = () => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.log.slice())
  // Graft until the turn passes and the enemy turn plays back.
  for (let i = 0; i < 6 && !(await page.locator('.enemy-turn-playback').count()); i++) {
    const graft = page.getByRole('button', { name: /^Graft:/ })
    if (await graft.isEnabled().catch(() => false)) await graft.click({ force: true })
    await page.waitForTimeout(400)
  }
  await expect.poll(async () => (await log()).filter((c) => c.startsWith('synth')).length, { timeout: 30_000 }).toBeGreaterThan(0)
  // Plan item 213: the market score ducks under Hollowell's muzak while his turn plays back.
  if (await page.locator('.enemy-turn-playback').count()) {
    expect(await page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.scoreMode())).toBe('muzak')
  }
})

// Plan item 213: the market score.
test('the market score renders offline: audible and under -3 dBFS, the market and the muzak, morning and evening', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as unknown as { __cathnivoreSound?: Snd }).__cathnivoreSound)
  for (const [mode, round] of [['market', 1], ['market', 8], ['muzak', 4]] as const) {
    const m = await page.evaluate(([md, r]) => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.measureScore(4, md, r), [mode, round] as const)
    expect(m.rms, `${mode} ${round}`).toBeGreaterThan(0.004)
    expect(m.peak, `${mode} ${round}`).toBeLessThan(0.708)
  }
})

test('the Music slider is saved across reloads and starts the score after a tap', async ({ page }) => {
  await page.goto('/')
  await page.getByText('Settings', { exact: true }).click()
  const music = page.locator('[data-music] input[type="range"]')
  await expect(music).toBeEnabled()
  // No AudioContext until a tap (the Settings tap above was the first; with Sound on it unlocked the score).
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.playing())).toBe(true)
  await music.fill('20')
  await expect(page.locator('[data-music] output')).toHaveText('20%')
  await page.reload()
  await page.getByText('Settings', { exact: true }).click()
  await expect(page.locator('[data-music] input[type="range"]')).toHaveValue('20')
  // Music at 0 stops the score; Sound off disables the slider.
  await page.locator('[data-music] input[type="range"]').fill('0')
  await expect(page.locator('[data-music] output')).toHaveText('Off')
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cathnivoreSound: Snd }).__cathnivoreSound.playing())).toBe(false)
  await page.getByLabel('Sound on').uncheck()
  await expect(page.locator('[data-music] input[type="range"]')).toBeDisabled()
})
