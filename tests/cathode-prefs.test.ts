import { beforeEach, describe, expect, it } from "vitest"
import { calmCameraOn, loadPrefs, savePrefs } from "../games/cathode/src/prefs"

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
    savePrefs({ ...loadPrefs(), bigSubs: true, calmCamera: true })
    expect(loadPrefs().bigSubs).toBe(true)
    expect(calmCameraOn()).toBe(true)
  })
  it("colour-safe and hold-toggle default off and round-trip", () => {
    expect(loadPrefs().colourSafe).toBe(false)
    expect(loadPrefs().holdToggle).toBe(false)
    savePrefs({ ...loadPrefs(), colourSafe: true, holdToggle: true })
    expect(loadPrefs().colourSafe).toBe(true)
    expect(loadPrefs().holdToggle).toBe(true)
  })
})
