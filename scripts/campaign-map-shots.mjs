import { chromium } from '@playwright/test'
const tag = process.argv[2] || 'before'
const out = process.env.OUT || '/home/user/Cathnivore/e2e/screenshots/map49'
const KEY = 'cathnivore:campaign:v1'
const states = { fresh: [], mid: ['fresh-meat', 'word-of-mouth', 'growing-season'], done: ['fresh-meat','word-of-mouth','growing-season','the-plan','friends-in-low-places','kingsmarket'] }
const b = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {})
for (const [vp, w, h] of [['P', 390, 844], ['D', 1440, 900], ['D2', 1280, 800], ['S', 375, 667]]) for (const scheme of ['light', 'dark']) for (const [name, completed] of Object.entries(states)) {
  if (scheme === 'dark' && name !== 'mid') continue
  const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  const p = await ctx.newPage()
  await p.addInitScript(([k, c]) => localStorage.setItem(k, JSON.stringify({ version: 1, completed: c, tutorialDone: true })), [KEY, completed])
  await p.goto((process.env.URL || 'http://localhost:4199/'))
  await p.getByRole('button', { name: 'Campaign' }).click()
  await p.waitForSelector('.cmp-map')
  await p.waitForTimeout(700)
  await p.screenshot({ path: `${out}/${tag}-${name}-${vp}-${scheme}.png` })
  await ctx.close()
}
await b.close()
