import { expect, test, type Page } from '@playwright/test'

// CATHODE C1 (docs/design/cathode-combat.md): cover tells the truth. A guard behind a steel crate gives the
// "blocked" brackets and no hit marker; his head over the crate is a hit. Driven through the screenshot
// stages (window.cathode.stage), which fire a real Kestrel round through the real combat code.

type Win = { cathode?: { stats: { frames: number }; stage?: (n: string, t?: number) => string; hud?: { hitClass: string | null } } }

async function boot(page: Page, touch = false): Promise<void> {
  // The phone project is upright; CATHODE plays held sideways (844x390), so turn it.
  if (touch) await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('/nightshift/')
  await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
  await page.goto('/nightshift/?play&shot&rs=0.5')
  await page.waitForFunction(() => ((window as unknown as Win).cathode?.stats.frames ?? 0) >= 2 && typeof (window as unknown as Win).cathode?.stage === 'function', null, { timeout: 200_000 })
}

const opacity = (page: Page, sel: string) => page.evaluate((q) => Number(getComputedStyle(document.querySelector(q)!).opacity), sel)

test.describe('CATHODE combat feedback', () => {
  test('a guard behind a crate gives `blocked` and no hit marker; his head over it is a hit', async ({ page, hasTouch }) => {
    test.setTimeout(300_000)
    await boot(page, hasTouch)
    const blocked = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('blocked', 40))
    expect(blocked).toBe('blocked')
    await page.waitForTimeout(400)
    expect(await opacity(page, '.hud-hit')).toBeLessThan(0.01)
    expect(await opacity(page, '.hud-blocked')).toBeGreaterThan(0.5)
    await expect(page.locator('.hud-blocked-l')).toBeVisible()

    const head = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('peek-head', 40))
    expect(head).toBe('head')
    await page.waitForTimeout(400)
    expect(await opacity(page, '.hud-hit')).toBeGreaterThan(0.5)
    await expect(page.locator('.hud-hit.c-head')).toHaveCount(1)
  })

  test('hitFlesh plays only for her rounds landing on an enemy, never when Cath is hit (S1.3 spy)', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough: the sound routing is the same')
    test.setTimeout(300_000)
    await boot(page)
    // Wrap the live session's audio: count every hitFlesh and hurt, then call through.
    const spied = await page.evaluate(() => {
      const c = (window as unknown as { cathode: { audio?: Record<string, (...a: unknown[]) => unknown> | null } }).cathode
      const a = c.audio
      if (!a) return false
      const w = window as unknown as { spy: { hitFlesh: number; hurt: number } }
      w.spy = { hitFlesh: 0, hurt: 0 }
      for (const k of ['hitFlesh', 'hurt'] as const) {
        const f = a[k]!.bind(a)
        a[k] = (...args: unknown[]) => {
          w.spy[k]++
          return f(...args)
        }
      }
      return true
    })
    expect(spied).toBe(true)
    const spy = () => page.evaluate(() => (window as unknown as { spy: { hitFlesh: number; hurt: number } }).spy)
    // Her round lands on a guard: one wet thud (the spy works).
    expect(await page.evaluate(() => (window as unknown as Win).cathode!.stage!('hit-body', 40))).toBe('body')
    expect((await spy()).hitFlesh).toBe(1)
    // Cath is shot, then struck in melee: her hurt sound each time, and no hitFlesh.
    await page.evaluate(() => {
      const c = (window as unknown as { cathode: { cathHurt: (b: number, m: boolean) => void } }).cathode
      c.cathHurt(0.5, false)
      c.cathHurt(-1, true)
    })
    expect(await spy()).toEqual({ hitFlesh: 1, hurt: 2 })
  })

  test('a hit on Cath points a damage arc at the attacker and splits Guard from Flesh (C6)', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough: the ring is the same unit-sized SVG at every size')
    test.setTimeout(300_000)
    await boot(page)
    type C6 = { cathode: { cathHurt: (b: number, m: boolean, a?: number) => void; stage: (n: string, t?: number) => string; vitals: { guard: number; flesh: number; maxGuard: number; maxFlesh: number }; hp: number; maxHp: number } }
    // A calm start, then the damage hook: a hit for 30% of her health from 60 degrees to her right.
    await page.evaluate(() => (window as unknown as C6).cathode.stage('pistol-idle', 0))
    const v = await page.evaluate(() => {
      const c = (window as unknown as C6).cathode
      c.cathHurt((60 * Math.PI) / 180, false, c.maxHp * 0.3)
      return { ...c.vitals, guard: c.vitals.guard, flesh: c.vitals.flesh, maxGuard: c.vitals.maxGuard, maxFlesh: c.vitals.maxFlesh, hp: c.hp, maxHp: c.maxHp }
    })
    // Guard (40%) takes the first 30%; Flesh is untouched, and the mirror reads the total.
    expect(v.guard).toBeCloseTo(v.maxGuard - v.maxHp * 0.3, 3)
    expect(v.flesh).toBeCloseTo(v.maxFlesh, 3)
    expect(v.hp).toBeCloseTo(v.maxHp * 0.7, 3)
    await page.waitForTimeout(300)
    // The lit arc's rotation, from its computed transform: within 10 degrees of 60.
    const rot = await page.evaluate(() => {
      const arcs = [...document.querySelectorAll('.hud-dmg-arc')].filter((g) => Number(getComputedStyle(g).opacity) > 0.3)
      if (!arcs.length) return null
      const m = new DOMMatrix(getComputedStyle(arcs[0]!).transform)
      return (Math.atan2(m.b, m.a) * 180) / Math.PI
    })
    expect(rot).not.toBeNull()
    expect(Math.abs(rot! - 60)).toBeLessThan(10)
    // Both layers show: Guard short, Flesh whole.
    await expect(page.locator('.hud-guard')).toBeVisible()
    await expect(page.locator('.hud-vbar.is-broken')).toHaveCount(0)
  })

  test('C15: six rifle rounds to the chest break the front plate (plateBreak on the bus)', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the rules are the same on the phone')
    test.setTimeout(300_000)
    await boot(page)
    const r = await page.evaluate(() => {
      const c = (window as unknown as { cathode: { stage: (n: string, t?: number) => string; combat: { bus: { log: { kind: string; e: { plateId?: string } }[] } } } }).cathode
      c.combat.bus.log.length = 0
      const cls = c.stage('plate-rifle-6', 40)
      const log = c.combat.bus.log
      return { cls, hits: log.filter((l) => l.kind === 'hit').length, breaks: log.filter((l) => l.kind === 'plateBreak').map((l) => l.e.plateId) }
    })
    expect(r.hits).toBe(6)
    expect(r.breaks).toEqual(['chestF'])
  })

  test('a kill rings the marker and clears the target bar', async ({ page, hasTouch }) => {
    // One phone run (the cover test) is enough: under SwiftShader each costs about a minute.
    test.skip(hasTouch, 'the phone layout is covered by the cover test above')
    test.setTimeout(300_000)
    await boot(page)
    // 650 ms on: past the bar's real collapse (180 ms flash and 400 ms fade).
    const cls = await page.evaluate(() => (window as unknown as Win).cathode!.stage!('hit-kill', 650))
    expect(cls).toBe('kill')
    await page.waitForTimeout(400)
    await expect(page.locator('.hud-hit.c-kill')).toHaveCount(1)
    await expect(page.locator('.hud-target')).toBeHidden()
  })
})

// C8 "Dying, done properly" (S6.6): death is a fall and a card, and Retry rebuilds the job in the same page.
test.describe('CATHODE death and Retry', () => {
  test('a lethal hit falls to the death card; Retry gives control back with no page load, the same session object', async ({ page, hasTouch }) => {
    // 3.7 min alone under SwiftShader, and it timed out once on a loaded box (C14 review): headroom, not a fix.
    test.setTimeout(600_000)
    if (hasTouch) await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=ghost&rs=0.5')
    type C = {
      stats: { frames: number; lastRestartMs?: number }
      hp: number
      deaths?: number
      dying?: { card: boolean } | null
      vitals: { maxTotal: number }
      player: { pos: { x: number; y: number; z: number } }
      progress: { character: unknown }
      hurtCath: (n: number, at: { x: number; y: number; z: number }, k: string) => void
      secondWind?: { phase: string; t: number; left: number }
    }
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number } } }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
    // The case file eases out over a few frames after the session starts; on a loaded box those frames are slow.
    // Die once it's gone, so the fall isn't drawn under it (the game also drops it on a death: main.ts onDying).
    await expect(page.locator('#loading')).toBeHidden({ timeout: 200_000 })
    const navigations: string[] = []
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) navigations.push(f.url())
    })
    await page.evaluate(() => {
      const w = window as unknown as { cathode: C; firstSession?: C }
      w.firstSession = w.cathode
      const c = w.cathode
      c.hurtCath(c.vitals.maxTotal * 3, { x: c.player.pos.x, y: c.player.pos.y + 1.4, z: c.player.pos.z - 9 }, 'bullet')
    })
    // C17 (S6.5): the first killing blow of a checkpoint is a Second Wind, not a death: she is on 1 Flesh, the world
    // slows, and with no kill in the 3.5 s window the death follows on its own.
    await page.waitForFunction(() => ['stop', 'window'].includes((window as unknown as { cathode: C }).cathode.secondWind?.phase ?? ''), null, { timeout: 60_000 })
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.dying ?? null)).toBeNull()
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.hp)).toBeGreaterThan(0)
    await expect(page.locator('.hud-sw.on')).toBeVisible({ timeout: 60_000 })
    await page.waitForFunction(() => !!(window as unknown as { cathode: C }).cathode.dying, null, { timeout: 200_000 })
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.secondWind?.phase)).toBe('spent')
    // The death runs on the real clock (up to 250 ms a frame), so the card is due ~2.2 s in however slow the frames.
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.dying?.card === true, null, { timeout: 200_000 }).catch(async (e) => {
      const why = await page.evaluate(() => ({ dying: (window as unknown as { cathode: C & { dying: unknown } }).cathode.dying, frames: (window as unknown as { cathode: C }).cathode.stats.frames, loading: !document.getElementById('loading')?.hidden }))
      throw new Error(`no death card: ${JSON.stringify(why)} (${String(e)})`)
    })
    await expect(page.locator('.death-card.on')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.death-line')).not.toHaveText('')
    await expect(page.locator('.death-card')).not.toContainText(/game over/i)
    if (hasTouch) await page.locator('.death-btn.is-primary').tap()
    else await page.keyboard.press('Enter')
    await page.waitForFunction(
      () => {
        const c = (window as unknown as { cathode: C }).cathode
        return c.dying === null && c.hp > 0 && typeof c.stats.lastRestartMs === 'number' && c.stats.frames >= 2
      },
      null,
      { timeout: 200_000 },
    )
    const after = await page.evaluate(() => {
      const w = window as unknown as { cathode: C; firstSession?: C }
      const saved = localStorage.getItem('cathode.save')
      return {
        same: w.firstSession === w.cathode,
        ms: w.cathode.stats.lastRestartMs,
        deaths: w.cathode.deaths,
        hp: w.cathode.hp,
        // A fresh resume: the character is what the save holds (nothing from the life she just lost).
        resumed: saved ? JSON.stringify((JSON.parse(saved) as { character: unknown }).character) === JSON.stringify(w.cathode.progress.character) : true,
      }
    })
    expect(navigations).toEqual([])
    expect(after.same).toBe(true)
    expect(after.hp).toBeGreaterThan(0)
    expect(after.deaths).toBe(1)
    expect(after.resumed).toBe(true)
    console.log(`lastRestartMs ${after.ms}`)
    expect(after.ms).toBeLessThan(1500)
    // The checkpoint gives the Second Wind back.
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.secondWind?.phase)).toBe('ready')
    // Control: the card is gone and the game frame runs on.
    await expect(page.locator('.death-card.on')).toHaveCount(0)
    const f0 = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.stats.frames)
    await page.waitForFunction((f) => (window as unknown as { cathode: C }).cathode.stats.frames > f + 2, f0, { timeout: 60_000 })
  })
})

// C17 "Kill cams" (S5.3): any input skips, but only after 300 ms; the camera is hers again and the world back at
// full speed on the next frame.
test.describe('CATHODE kill cams', () => {
  test('a key in the first 300 ms does not skip; after it, it does, and simScale is 1 on the next frame', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough: the skip is the same input path')
    test.setTimeout(400_000)
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=ghost&rs=0.5')
    type K = { active: boolean; shot: string | null; ms: number; scale: number; returnMs: number }
    type C = { stats: { frames: number }; killcamTest: () => boolean; killcamState: () => K }
    const st = () => page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      return { ...c.killcamState(), frames: c.stats.frames }
    })
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number } } }).cathode?.stats.frames ?? 0) >= 3, null, { timeout: 200_000 })
    await expect(page.locator('#loading')).toBeHidden({ timeout: 200_000 })
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.killcamTest())).toBe(true)
    const a = await st()
    expect(a.active).toBe(true)
    expect(a.shot).toBe('orbit')
    // Early: the press is eaten (the shot that earned it must not skip it).
    if (a.ms < 200) {
      await page.keyboard.press('KeyJ')
      const f = (await st()).frames
      await page.waitForFunction((f0) => (window as unknown as { cathode: C }).cathode.stats.frames > f0 + 1, f, { timeout: 60_000 })
      const b = await st()
      if (b.ms < 300 + 120) expect(b.active).toBe(true)
    }
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.killcamState().ms >= 320, null, { timeout: 200_000 })
    const before = await st()
    expect(before.active).toBe(true)
    expect(before.scale).toBeLessThan(1)
    await page.keyboard.press('KeyJ')
    await page.waitForFunction(() => !(window as unknown as { cathode: C }).cathode.killcamState().active, null, { timeout: 60_000 })
    const f1 = (await st()).frames
    await page.waitForFunction((f0) => (window as unknown as { cathode: C }).cathode.stats.frames > f0, f1, { timeout: 60_000 })
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.killcamState().returnMs >= 0, null, { timeout: 60_000 })
    const after = await st()
    expect(after.active).toBe(false)
    expect(after.scale).toBe(1)
    // From the key to the first frame back on her eyes at full speed (real ms, measured by the game).
    console.log(`kill-cam return ${after.returnMs.toFixed(0)} ms`)
    expect(after.returnMs).toBeLessThanOrEqual(300)
    await expect(page.locator('.hud-root.kc-cine')).toHaveCount(0)
  })
})

// C11 "Takedowns" (S5.2): the press locks input for the paired sequence (0.9 to 1.4 s of game time), the camera
// is the director's, and the guard ends as a sleeping ragdoll on the street.
test.describe('CATHODE takedowns', () => {
  test('the first guard: the chip, a locked 0.9-1.4 s sequence under the letterbox, and he ends asleep on the street', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'one layout is enough: the sequence is the same on a phone')
    test.setTimeout(400_000)
    // Landscape: in portrait the rotate card holds the game and the chip never shows.
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=ghost&rs=0.5')
    type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): void; distanceTo(o: V3): number }
    type E = { alive: boolean; position: V3; motion: { yaw: number }; body: { asleep: boolean; joints: { pelvis: V3 } } }
    type C = {
      stats: { frames: number }
      enemies: E[]
      job: { skipTo(n: number): void }
      player: { pos: V3; yaw: number; pitch: number }
      input: { forced: Record<string, boolean> }
      combat: { kills: unknown[] }
      takedown: { active: boolean; lockMs: number; real: number; variant: { id: string } | null }
    }
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number }; job?: unknown } }).cathode?.job ? 1 : 0) && ((window as unknown as { cathode: C }).cathode.stats.frames >= 3), null, { timeout: 200_000 })
    // Behind the guard under the lamp, 1.3 m off, looking at him.
    await page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      c.job.skipTo(1)
      const g = c.enemies.filter((e) => e.alive).sort((a, b) => a.position.distanceTo(c.player.pos) - b.position.distanceTo(c.player.pos))[0]!
      const yaw = g.motion.yaw
      c.player.pos.set(g.position.x - Math.sin(yaw) * 1.3, g.position.y, g.position.z - Math.cos(yaw) * 1.3)
      // Player yaw faces -z at 0: look along his facing (at his back).
      c.player.yaw = Math.atan2(-Math.sin(yaw), -Math.cos(yaw))
      c.player.pitch = -0.15
    })
    await page.waitForFunction((f) => (window as unknown as { cathode: C }).cathode.stats.frames >= f + 2, await page.evaluate(() => (window as unknown as { cathode: C }).cathode.stats.frames))
    await expect(page.locator('.hud-prompt.world')).toBeVisible()
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { takedown: true }))
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.takedown.active, null, { timeout: 60_000 })
    expect(await page.evaluate(() => (window as unknown as { cathode: C }).cathode.takedown.variant?.id)).toBe('behindWrap')
    // Input is locked: a trigger pull mid-sequence does nothing, and the cinema letterbox is up.
    await page.evaluate(() => ((window as unknown as { cathode: C }).cathode.input.forced = { fire: true }))
    await expect(page.locator('.hud-root.td-cine')).toHaveCount(1)
    await page.waitForFunction(() => !(window as unknown as { cathode: C }).cathode.takedown.active, null, { timeout: 200_000 })
    const lock = await page.evaluate(() => (window as unknown as { cathode: C }).cathode.takedown.lockMs)
    expect(lock).toBeGreaterThanOrEqual(900)
    expect(lock).toBeLessThanOrEqual(1400)
    // He ends as a sleeping ragdoll, lying on the street.
    await page.waitForFunction(() => {
      const c = (window as unknown as { cathode: C }).cathode
      return c.enemies.some((e) => !e.alive && e.body.asleep)
    }, null, { timeout: 200_000 })
    const pelvisUp = await page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      const e = c.enemies.find((x) => !x.alive && x.body.asleep)!
      return e.body.joints.pelvis.y - e.position.y
    })
    expect(pelvisUp).toBeLessThan(0.45)
    await expect(page.locator('.hud-root.td-cine')).toHaveCount(0)
  })

  // On touch the world chip is the takedown button (C11 review 2: that path was never driven): a 44 px target
  // beside his helmet, and a tap on it starts the sequence.
  test('touch: a tap on the world chip is the takedown', async ({ page, hasTouch }) => {
    test.skip(!hasTouch, 'the chip is a button on touch only')
    test.setTimeout(400_000)
    // Landscape: in portrait the rotate card holds the game and the chip never shows.
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/nightshift/')
    await page.evaluate(() => localStorage.setItem('cathode:prefs:v1', JSON.stringify({ adult: true, intensity: 'full', quality: 'phone' })))
    await page.goto('/nightshift/?play&class=ghost&rs=0.5')
    type V3 = { x: number; y: number; z: number; set(x: number, y: number, z: number): void; distanceTo(o: V3): number }
    type E = { alive: boolean; position: V3; motion: { yaw: number } }
    type C = {
      stats: { frames: number }
      enemies: E[]
      job: { skipTo(n: number): void }
      player: { pos: V3; yaw: number; pitch: number }
      takedown: { active: boolean }
    }
    await page.waitForFunction(() => ((window as unknown as { cathode?: { stats: { frames: number }; job?: unknown } }).cathode?.job ? 1 : 0) && ((window as unknown as { cathode: C }).cathode.stats.frames >= 3), null, { timeout: 200_000 })
    await page.evaluate(() => {
      const c = (window as unknown as { cathode: C }).cathode
      c.job.skipTo(1)
      const g = c.enemies.filter((e) => e.alive).sort((a, b) => a.position.distanceTo(c.player.pos) - b.position.distanceTo(c.player.pos))[0]!
      const yaw = g.motion.yaw
      c.player.pos.set(g.position.x - Math.sin(yaw) * 1.3, g.position.y, g.position.z - Math.cos(yaw) * 1.3)
      c.player.yaw = Math.atan2(-Math.sin(yaw), -Math.cos(yaw))
      c.player.pitch = -0.15
    })
    const chip = page.locator('.hud-prompt.world')
    await expect(chip).toBeVisible({ timeout: 60_000 })
    const box = (await chip.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    await chip.tap()
    await page.waitForFunction(() => (window as unknown as { cathode: C }).cathode.takedown.active, null, { timeout: 60_000 })
  })

  test('C14: Escape opens the pause within 200 ms over the graded frame, and one Escape resumes', async ({ page, hasTouch }) => {
    test.skip(hasTouch, 'the pause key is a keyboard path; touch opens it from the menu button')
    test.setTimeout(300_000)
    await boot(page, hasTouch)
    await page.waitForTimeout(600)
    await expect(page.locator('.hud-pause')).toBeHidden()
    // The keypress, timed in the page: the menu is on screen within 200 ms of the key going down.
    const ms = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const t0 = performance.now()
          const poll = () => {
            const p = document.querySelector('.hud-pause') as HTMLElement | null
            if (p && !p.hidden) resolve(performance.now() - t0)
            else if (performance.now() - t0 > 2000) resolve(9999)
            else requestAnimationFrame(poll)
          }
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
          poll()
        }),
    )
    expect(ms).toBeLessThan(200)
    await expect(page.locator('.hud-pm-crumbs')).toHaveText(/pause/i)
    await expect(page.locator('.hud-pm-item')).toHaveText([/resume/i, /case board/i, /character/i, /settings/i, /quit to title/i])
    await expect(page.locator('.hud-pm-note-obj')).not.toBeEmpty()
    // Settings is a page: Escape goes back to the menu first; then one Escape resumes.
    await page.locator('.hud-pm-item', { hasText: /settings/i }).click()
    await expect(page.locator('.hud-pm-crumbs')).toHaveText(/pause \/ settings/i)
    await page.keyboard.press('Escape')
    await expect(page.locator('.hud-pm-crumbs')).toHaveText(/^pause$/i)
    await page.keyboard.press('Escape')
    await expect(page.locator('.hud-pause')).toBeHidden({ timeout: 5_000 })
  })
})
