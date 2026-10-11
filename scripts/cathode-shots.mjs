// CATHODE screenshots (ROADMAP 101, extended for AAA UI M2): the gate, the HUD (quiet and busy), and the
// pause card at P 390x844, L 844x390 (touch, as on an iPhone held sideways) and D 1440x900, each again with
// reduced motion. Prints a HUD overlap report (no two clusters may touch; touch buttons 44 px or more) and
// any CSP violations.
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  node scripts/cathode-shots.mjs
// Env: CATHODE_URL (default http://localhost:4180/cathode/), OUT (default e2e/screenshots), ONLY (comma list
// of scenes: gate,focus,hud,busy,boss,pause; focus shoots the keyboard focus ring on the gate and pause buttons), SIZES (comma list of P,L,D), RM=0 to skip the reduced-motion pass.
// Set PLAYWRIGHT_CHROMIUM_PATH if the pinned Chromium revision is missing (see CLAUDE.md).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const base = process.env.CATHODE_URL ?? 'http://localhost:4180/cathode/'
const out = process.env.OUT ?? 'e2e/screenshots'
const only = (process.env.ONLY ?? 'gate,focus,hud,busy,boss,pause').split(',')
const sizeKeys = (process.env.SIZES ?? 'P,L,D').split(',')
mkdirSync(out, { recursive: true })
const SIZES = {
  P: { name: 'phone', viewport: { width: 390, height: 844 } },
  L: { name: 'landscape', viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true },
  D: { name: 'desktop', viewport: { width: 1440, height: 900 } },
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
const problems = []

/** Swiftshader runs a frame every few seconds, so CSS entrances barely start: finish the one-shot ones. */
async function settle(page) {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) {
      const t = a.effect?.getTiming?.()
      if (t && t.iterations !== Infinity && !/feed-life|feed-fade|banner/.test(a.animationName ?? '')) a.finish()
    }
  })
  await page.waitForTimeout(500)
}

/** Fills the HUD the way a busy moment looks: a long subtitle, a kill feed, a pickup, the objective. */
async function busy(page) {
  await page.evaluate(() => {
    const hud = window.cathode?.hud
    if (!hud) return
    // Swiftshader takes seconds per screenshot: keep the lines on screen until it's taken.
    const st = window.setTimeout
    window.setTimeout = (f, ms, ...a) => (ms > 1000 ? 0 : st(f, ms, ...a))
    // A gun in hand and a few hits taken, so the numerals, the segmented bar and its trail show.
    const c = window.cathode
    try {
      c.arsenal.owned.add('kestrel')
      c.arsenal.equipId('kestrel')
      c.hp = Math.round(c.maxHp * 0.62)
    } catch {}
    hud.subtitle('Bea: The ledger is in the back office, under the ice trays. Get it and get out before the Hollowell boys finish their smoke.')
    hud.feedLine('+90 XP · Headshot · Unseen', true)
    hud.feedLine('+40 XP · Takedown')
    hud.feedItem('Kestrel .38 · Modded', 'rare')
    window.setTimeout = st
    for (const a of document.getAnimations()) if (a.animationName === 'feed-life' || a.animationName === 'feed-fade') a.currentTime = 1000
    setTimeout(() => { for (const a of document.getAnimations()) if (a.animationName === 'feed-life' || a.animationName === 'feed-fade') a.pause() }, 50)
  })
  await page.waitForTimeout(4000)
}

/** Every visible HUD cluster rectangle, overlapping pairs, and touch buttons under 44 px. */
async function overlapReport(page, label) {
  const r = await page.evaluate(() => {
    const sel = ['.hud-vitals', '.hud-arms', '.hud-sub.on', '.hud-objective', '.hud-feed', '.hud-teach.on', '.tbtn', '.tbtn-menu', '.stick']
    const boxes = []
    for (const s of sel) {
      for (const e of document.querySelectorAll(s)) {
        const b = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        if (b.width < 1 || b.height < 1 || cs.visibility === 'hidden' || cs.display === 'none' || e.closest('[hidden]')) continue
        if (s === '.hud-feed' && !e.children.length) continue
        boxes.push({ s: s + (e.className.match(/tbtn-\w+/)?.[0] ?? ''), l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height })
      }
    }
    const hits = []
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], c = boxes[j]
        if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.b - 1 && c.t < a.b - 1) hits.push(`${a.s} x ${c.s}`)
      }
    const small = boxes.filter((b) => b.s.startsWith('.tbtn') && (b.w < 44 || b.h < 44)).map((b) => `${b.s} ${Math.round(b.w)}x${Math.round(b.h)}`)
    return { boxes: boxes.map((b) => `${b.s} ${Math.round(b.l)},${Math.round(b.t)} ${Math.round(b.w)}x${Math.round(b.h)}`), hits, small }
  })
  console.log(`-- overlap ${label}: ${r.hits.length} overlaps, ${r.small.length} small buttons`)
  for (const h of r.hits) console.log(`   OVERLAP ${h}`)
  for (const s of r.small) console.log(`   SMALL ${s}`)
  if (r.hits.length || r.small.length) problems.push(label)
  if (process.env.VERBOSE) console.log(r.boxes.join('\n'))
}

for (const rm of process.env.RM === '0' ? [false] : [false, true]) {
  for (const key of sizeKeys) {
    const size = SIZES[key]
    const tag = `${size.name}${rm ? '-rm' : ''}`
    const ctx = await browser.newContext({ viewport: size.viewport, hasTouch: !!size.hasTouch, isMobile: !!size.isMobile, reducedMotion: rm ? 'reduce' : 'no-preference' })
    const page = await ctx.newPage()
    page.on('console', (m) => { if (/Content Security Policy|Refused to/.test(m.text())) problems.push(`CSP ${tag}: ${m.text()}`) })
    if (only.includes('gate')) {
      await page.goto(base)
      await page.waitForTimeout(2500)
      await page.screenshot({ path: `${out}/cathode-gate-${tag}.png` })
    }
    if (only.includes('focus') && !size.hasTouch) {
      // A real Tab, so :focus-visible matches; the ring must show on the clip-pathed ticket button.
      if (!only.includes('gate')) { await page.goto(base); await page.waitForTimeout(2500) }
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press('Tab')
        if (await page.evaluate(() => document.activeElement?.id === 'gate-yes')) break
      }
      await settle(page)
      await page.screenshot({ path: `${out}/cathode-gate-focus-${tag}.png` })
    }
    if (only.some((s) => s !== 'gate' && s !== 'focus')) {
      await page.goto(`${base}?play&shot`)
      await page.waitForFunction(() => (window.cathode?.stats.frames ?? 0) > 2, null, { timeout: 120_000 })
      await page.waitForTimeout(5000)
      await settle(page)
      if (only.includes('hud')) await page.screenshot({ path: `${out}/cathode-hud-${tag}.png`, timeout: 180_000 })
      if (only.includes('busy')) {
        await busy(page)
        await settle(page)
        await page.screenshot({ path: `${out}/cathode-hud-busy-${tag}.png`, timeout: 180_000 })
        await overlapReport(page, tag)
      }
      if (only.includes('boss')) {
        await page.evaluate(() => {
          const st = window.setTimeout
          window.setTimeout = (f, ms, ...a) => (ms > 1000 ? 0 : st(f, ms, ...a))
          window.cathode?.hud?.showBanner('Mother Crisp', 'The butcher of Pier 9', 'boss')
          window.setTimeout = st
        })
        // The banner restarts its entrance on the next frame, and a frame can take seconds here: wait until
        // that animation has really started, freeze it mid-hold, and wait for the pause to commit.
        const ready = () => {
          const a = document.querySelector('.hud-banner.on')?.getAnimations().find((x) => x.animationName === 'banner' || x.animationName === 'feed-fade')
          return !!a && !a.pending
        }
        await page.waitForFunction(ready, null, { timeout: 90_000 })
        await page.evaluate(() => {
          for (const a of document.getAnimations()) if (a.animationName === 'banner' || a.animationName === 'feed-fade') { a.pause(); a.currentTime = 1200 }
        })
        await page.waitForFunction(ready, null, { timeout: 90_000 })
        await settle(page)
        await page.screenshot({ path: `${out}/cathode-hud-boss-${tag}.png`, timeout: 180_000 })
      }
      if (only.includes('pause')) {
        // The boss scene's banner timer was swallowed above, so end its intro by hand before pausing.
        await page.evaluate(() => {
          document.querySelector('.hud-root')?.classList.remove('boss-intro', 'banner-on')
          document.documentElement.classList.remove('hud-banner-on')
          window.cathode.input.menuTapped = true
        })
        // The session loop opens the card on its next frame, which under swiftshader can take seconds: wait
        // for a card with a real rect, and fail loudly rather than shoot a dimmed world.
        const shown = await page
          .waitForFunction(() => {
            const c = document.querySelector('.hud-pause:not([hidden]) .hud-pause-card')
            const r = c?.getBoundingClientRect()
            return !!r && r.width > 0 && r.height > 0
          }, null, { timeout: 60_000 })
          .then(() => true, () => false)
        if (!shown) problems.push(`pause ${tag}: the pause card never showed`)
        await settle(page)
        await page.waitForTimeout(2500)
        await page.screenshot({ path: `${out}/cathode-pause-${tag}.png`, timeout: 180_000 })
        if (only.includes('focus') && !size.hasTouch) {
          await page.keyboard.press('Shift')
          await page.evaluate(() => document.querySelector('.hud-resume')?.focus({ focusVisible: true }))
          await page.waitForTimeout(1500)
          await page.screenshot({ path: `${out}/cathode-pause-focus-${tag}.png`, timeout: 180_000 })
        }
      }
    }
    await ctx.close()
  }
}
await browser.close()
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'shots ok: no overlaps, no small buttons, no CSP violations')
