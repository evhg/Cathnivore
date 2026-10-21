// C14 (docs/design/cathode-combat.md S9.6): the loading screen's portrait plate of each name on The List. Each
// name's rig (the kit they fight in) under one hard top light, head and shoulders at 1:1.25, rendered by the
// turntable's portrait view (`?shot&arch=<kit>&view=portrait&yaw=<deg>`, game/turntable.ts) and written to
// games/cathode/public/portraits/<job>.webp. Not shipped (DECISIONS 2026-10-21): the bosses share one rig, so the
// loading screen has no plate; kept for when each name has a dressed identity.
//
//   npm run build:site && npx vite preview --outDir dist-site --port 4180 &
//   PLAYWRIGHT_CHROMIUM_PATH=... node scripts/cathode-portraits.mjs [job ...]
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = 'games/cathode/public/portraits'
mkdirSync(out, { recursive: true })
// The kit each name fights in (crispboss.ts ... vaultboss.ts), and a turn so no two plates sit the same way.
const NAMES = {
  crispBoss: { arch: 'riot', yaw: 24 },
  vaneBoss: { arch: 'leader', yaw: -20 },
  pellBoss: { arch: 'riot', yaw: -32 },
  boardBoss: { arch: 'riot', yaw: 8 },
  vaultBoss: { arch: 'riot', yaw: 40 },
}
const jobs = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(NAMES)
const W = 640
const H = 800
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
for (const job of jobs) {
  const n = NAMES[job]
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(`${base}?shot&arch=${n.arch}&view=portrait&yaw=${n.yaw}`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForFunction(() => window.cathodeTurntable?.ready, null, { timeout: 300_000 })
  await page.waitForTimeout(500)
  const png = await page.screenshot({ timeout: 300_000 })
  const enc = await browser.newPage()
  const b64 = await enc.evaluate(
    async ([src, w, h]) => {
      const img = new Image()
      img.src = `data:image/png;base64,${src}`
      await img.decode()
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      return c.toDataURL('image/webp', 0.78).split(',')[1]
    },
    [png.toString('base64'), W, H],
  )
  await enc.close()
  const buf = Buffer.from(b64, 'base64')
  writeFileSync(`${out}/${job}.webp`, buf)
  console.log(job, `${(buf.length / 1024).toFixed(0)} KB`)
  await ctx.close()
}
await browser.close()
