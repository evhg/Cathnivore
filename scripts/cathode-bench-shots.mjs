// Plan item 16: the office gun bench at D and L: the bench at rest from her spot, then the bench screen over the
// close-up with a fully built gun (each slot fitted), and the parts list open on a slot.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathode-bench-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/nightshift/'
const out = process.env.OUT ?? 'e2e/screenshots'
const model = process.env.GUN ?? 'rifle'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const ONLY = process.env.SIZE
const SIZES = [
  ['desktop', { viewport: { width: 1440, height: 900 } }],
  ['landscape', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
]
const NAMES = { rifle: 'Corridor AR', sniper: 'Widowmaker', smg: 'Rattlecan', shotgun: 'The Fishmonger', pistol: 'Kestrel 9', revolver: 'Old Testament' }
const BASES = { rifle: 'corridorAR', sniper: 'widowmaker', smg: 'rattlecan', shotgun: 'fishmonger', pistol: 'kestrel', revolver: 'oldTestament' }
const PARTS = {
  rifle: { barrel: 'longBarrel', scope: 'redDot', suppressor: 'can', mag: 'drumMag', stock: 'marksmanStock' },
  sniper: { barrel: 'flutedBarrel', suppressor: 'subsonicBaffle', mag: 'extendedMag', stock: 'paddedStock' },
  smg: { scope: 'fourGlass', suppressor: 'can', mag: 'extendedMag', stock: 'skeletonStock' },
  shotgun: { barrel: 'chokeBarrel', scope: 'redDot', mag: 'drumMag', stock: 'paddedStock' },
  pistol: { scope: 'redDot', mag: 'extendedMag', stock: 'paddedStock' },
  revolver: { barrel: 'longBarrel', scope: 'fourGlass', stock: 'paddedStock' },
}
for (const [name, opts] of SIZES.filter(([n]) => !ONLY || n === ONLY)) {
  const page = await browser.newPage(opts)
  await page.goto(base)
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'low' })))
  await page.goto(`${base}?play&shot&district=office`)
  await page.waitForFunction(() => window.cathode?.player, null, { timeout: 120000 })
  // A built gun in the first weapon slot, and Scrip to spend.
  await page.evaluate(([parts, baseId, name]) => {
    const p = window.cathode.progress
    const c = p.character
    const w = c.equipment.weapon1
    p.set({ ...c, scrip: 6000, equipment: { ...c.equipment, weapon1: { ...w, base: baseId, name, parts } } })
  }, [PARTS[model], BASES[model], NAMES[model]])
  await page.evaluate(() => {
    const p = window.cathode.player
    p.pos.set(3.4, p.pos.y, -0.6)
    p.yaw = -1.5708
    p.pitch = -0.35
    window.cathode.input.forced.takedown = true
  })
  await page.waitForSelector('.bench', { timeout: 60000 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${out}/bench-${model}-${name}.png`, timeout: 120000 })
  console.log(`bench-${model}-${name}`, await page.evaluate(() => window.cathode.benchParts?.join(',')))
  await page.click('[data-k="slot:scope"]')
  await page.hover('[data-k="part:fourGlass"]').catch(() => {})
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${out}/bench-${model}-optic-${name}.png`, timeout: 120000 })
  // The wardrobe: a spare coat in the bag, Cath at the mirror.
  await page.keyboard.press('Escape')
  await page.evaluate(() => {
    const p = window.cathode.progress
    const c = p.character
    p.set({ ...c, inventory: [...c.inventory, { ...c.equipment.coat, uid: 'shot-coat', name: 'Oilskin Duster', rarity: 'rare' }] })
    const pl = window.cathode.player
    pl.pos.set(-3.4, pl.pos.y, -1.6)
    window.cathode.input.forced.takedown = true
  })
  await page.waitForSelector('.wardrobe', { timeout: 60000 })
  await page.hover('[data-k="wear:shot-coat"]').catch(() => {})
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${out}/wardrobe-${name}.png`, timeout: 120000 })
  console.log(`wardrobe-${name}`)
  await page.close()
}
await browser.close()
