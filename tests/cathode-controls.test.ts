import { describe, expect, it } from "vitest"
import { BINDABLE, cleanBinds, codesFor, keyLabel, rebind } from "../games/cathode/src/controls"

describe("key bindings", () => {
  it("falls back to defaults and honours a rebind", () => {
    expect(codesFor({}, "jump")).toEqual(["Space"])
    expect(codesFor({ jump: "KeyJ" }, "jump")).toEqual(["KeyJ"])
    expect(codesFor({}, "nope")).toEqual([])
  })
  it("a key never does two jobs", () => {
    const b = rebind({ jump: "KeyJ" }, "reload", "KeyJ")
    expect(b).toEqual({ reload: "KeyJ" })
    expect(codesFor(b, "jump")).toEqual(["Space"])
  })
  it("cleans stored junk and labels keys", () => {
    expect(cleanBinds({ jump: "KeyJ", bogus: "KeyX", reload: 4 })).toEqual({ jump: "KeyJ" })
    expect(cleanBinds(null)).toEqual({})
    expect(keyLabel("KeyW")).toBe("W")
    expect(keyLabel("ShiftLeft")).toBe("Shift L")
    expect(BINDABLE.every((b) => b.def.length > 0)).toBe(true)
  })
})
