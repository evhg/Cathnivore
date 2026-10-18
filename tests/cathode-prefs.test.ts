import { beforeEach, describe, expect, it } from "vitest"
import { calmCameraOn, damageFxLevels, loadPrefs, savePrefs } from "../games/cathode/src/prefs"

function stubStorage() {
  const m = new Map<string, string>()
  Object.assign(globalThis, { localStorage: {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  } })
}

describe("accessibility prefs", () => {
  beforeEach(stubStorage)
  it("defaults off and round-trips", () => {
    expect(loadPrefs().bigSubs).toBe(false)
    expect(loadPrefs().calmCamera).toBe(false)
    savePrefs({ ...loadPrefs(), bigSubs: true, calmCamera: true, crossScale: 1.5 })
    expect(loadPrefs().bigSubs).toBe(true)
    expect(calmCameraOn()).toBe(true)
    expect(loadPrefs().crossScale).toBe(1.5)
  })
  it("colour-safe and hold-toggle default off and round-trip", () => {
    expect(loadPrefs().colourSafe).toBe(false)
    expect(loadPrefs().holdToggle).toBe(false)
    savePrefs({ ...loadPrefs(), colourSafe: true, holdToggle: true })
    expect(loadPrefs().colourSafe).toBe(true)
    expect(loadPrefs().holdToggle).toBe(true)
  })
})

describe("look prefs", () => {
  beforeEach(stubStorage)
  it("defaults, round-trips and rejects out-of-range sensitivity", () => {
    expect(loadPrefs().lookScale).toBe(1)
    expect(loadPrefs().invertY).toBe(false)
    savePrefs({ ...loadPrefs(), lookScale: 1.8, invertY: true })
    expect(loadPrefs().lookScale).toBe(1.8)
    expect(loadPrefs().invertY).toBe(true)
    savePrefs({ ...loadPrefs(), lookScale: 9 })
    expect(loadPrefs().lookScale).toBe(1)
  })
})

describe("C7 damage-effects and heartbeat prefs", () => {
  beforeEach(stubStorage)
  it("default to full effects with the heartbeat on, round-trip, and reject junk", () => {
    expect(loadPrefs().damageFx).toBe("full")
    expect(loadPrefs().heartbeat).toBe(true)
    savePrefs({ ...loadPrefs(), damageFx: "reduced", heartbeat: false })
    expect(loadPrefs().damageFx).toBe("reduced")
    expect(loadPrefs().heartbeat).toBe(false)
    localStorage.setItem("cathode:prefs:v1", JSON.stringify({ damageFx: "loud", heartbeat: "yes" }))
    expect(loadPrefs().damageFx).toBe("full")
    expect(loadPrefs().heartbeat).toBe(true)
  })
  it("offers Full, Reduced and Minimal, each doing what S9.8 says", () => {
    savePrefs({ ...loadPrefs(), damageFx: "minimal" })
    expect(loadPrefs().damageFx).toBe("minimal")
    const full = damageFxLevels("full")
    const red = damageFxLevels("reduced")
    const min = damageFxLevels("minimal")
    expect(full).toMatchObject({ grade: 1, ca: 1, lens: true, wobble: true })
    // Minimal: no CA or radial smear, the vignette halved, the indicator kept.
    expect(min.ca).toBe(0)
    expect(min.grade).toBe(0.5)
    expect(min.indicator).toBe(true)
    expect(min.lens).toBe(false)
    expect(min.wobble).toBe(false)
    // Reduced sits between: softer than Full, stronger than Minimal, the CA kept.
    expect(red.grade).toBeLessThan(full.grade)
    expect(red.grade).toBeGreaterThan(min.grade)
    expect(red.ca).toBe(1)
    expect(red.lens).toBe(false)
  })
})
