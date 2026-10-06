import { describe, expect, it } from "vitest"
import { PHOTO_FILTERS } from "../games/cathode/src/ui/photomode"

describe("photo mode presets", () => {
  it("starts with an unfiltered preset and has unique ids", () => {
    expect(PHOTO_FILTERS[0]?.css).toBe("none")
    expect(new Set(PHOTO_FILTERS.map((f) => f.id)).size).toBe(PHOTO_FILTERS.length)
  })
})
