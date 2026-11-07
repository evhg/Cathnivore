import { describe, expect, it } from "vitest";
import { STOP_ART_KEYS, stopArtKey, stopArtSvg } from "../games/hedgerow/src/stopart";

// Plan item 241: every stop on the journey map is its own painted landmark, in its act's palette.
describe("hedgerow stop art", () => {
  it("draws a landmark for each of the hundred stops", () => {
    for (let id = 1; id <= 100; id++) {
      expect(STOP_ART_KEYS, `level ${id}`).toContain(stopArtKey(id));
      const svg = stopArtSvg(id);
      expect(svg).toMatch(/^<ellipse/); // its patch of ground first
      expect(svg).toContain("data-sh"); // shading a locked stop drops
      expect(svg).not.toMatch(/NaN|undefined/);
    }
  });
  it("gives each act at least eight different landmarks, none repeated side by side", () => {
    for (let act = 0; act < 10; act++) {
      const keys = Array.from({ length: 10 }, (_, i) => stopArtKey(act * 10 + i + 1));
      expect(new Set(keys).size, `act ${act + 1}`).toBeGreaterThanOrEqual(8);
      keys.forEach((k, i) => i && expect(k, `act ${act + 1} stop ${i + 1}`).not.toBe(keys[i - 1]));
    }
  });
  it("paints the same landmark in each act's own palette", () => {
    // Level 1 and level 35 are both cottages; their ground and roofs differ.
    expect(stopArtKey(1)).toBe(stopArtKey(35));
    expect(stopArtSvg(1)).not.toBe(stopArtSvg(35));
  });
});
