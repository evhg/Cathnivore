import { describe, expect, it } from "vitest"
import { nextResuming, pauseView, type PauseIn } from "../games/cathode/src/game/pausegate"

const base: PauseIn = { touch: false, locked: true, exempt: false, dead: false, charScreen: false, portrait: false, coaching: false, menuOpen: false, resuming: false }

describe("C14 pause gate (desktop pointer lock)", () => {
  it("plays while locked, pauses when the pointer is freed", () => {
    expect(pauseView(base)).toEqual({ frozen: false, menu: false, clickToResume: false })
    expect(pauseView({ ...base, locked: false })).toEqual({ frozen: true, menu: true, clickToResume: false })
  })

  it("locked -> Esc -> pause -> Esc with the re-lock refused waits on click to resume, never reopens the menu", () => {
    // Esc in lock: the browser frees the pointer, the frame opens the pause.
    let s: PauseIn = { ...base, locked: false }
    expect(pauseView(s).menu).toBe(true)
    // Esc in the pause: the menu closes and a resume is asked for; requestPointerLock is refused.
    s = { ...s, menuOpen: false, resuming: true }
    for (let frame = 0; frame < 120; frame++) {
      s = { ...s, resuming: nextResuming(s.resuming, s.locked, s.menuOpen) }
      const v = pauseView(s)
      expect(v.menu).toBe(false)
      expect(v.clickToResume).toBe(true)
      expect(v.frozen).toBe(true)
    }
    // The click locks: play resumes and the resume flag clears.
    s = { ...s, locked: true }
    s = { ...s, resuming: nextResuming(s.resuming, s.locked, s.menuOpen) }
    expect(s.resuming).toBe(false)
    expect(pauseView(s)).toEqual({ frozen: false, menu: false, clickToResume: false })
    // Freeing the pointer again pauses again (the resume state does not linger).
    expect(pauseView({ ...s, locked: false }).menu).toBe(true)
  })

  it("Esc while waiting reopens the menu", () => {
    const s: PauseIn = { ...base, locked: false, resuming: true, menuOpen: true }
    expect(nextResuming(s.resuming, s.locked, s.menuOpen)).toBe(false)
    expect(pauseView({ ...s, resuming: false }).menu).toBe(true)
  })

  it("touch, webdriver and shots never wait on a click", () => {
    expect(pauseView({ ...base, touch: true, locked: false, resuming: true })).toEqual({ frozen: false, menu: false, clickToResume: false })
    expect(pauseView({ ...base, exempt: true, locked: false, resuming: true })).toEqual({ frozen: false, menu: false, clickToResume: false })
    expect(pauseView({ ...base, touch: true, menuOpen: true }).menu).toBe(true)
  })

  it("portrait and coaching freeze without the menu", () => {
    expect(pauseView({ ...base, touch: true, portrait: true })).toEqual({ frozen: true, menu: false, clickToResume: false })
    expect(pauseView({ ...base, coaching: true, locked: false })).toEqual({ frozen: true, menu: false, clickToResume: false })
  })
})
