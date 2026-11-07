// Plan item 230: the journey map's land round a stop follows its stars: coloured in once won, Hollowell's clutter
// while not yet won, the plain ground at the next stop.
import { describe, expect, it } from "vitest";
import { landState, stopLandSvg } from "../games/hedgerow/src/stopland";

describe("stop land", () => {
  it("follows the stars", () => {
    expect(landState(0, false)).toBe("held");
    expect(landState(0, true)).toBe("next");
    expect(landState(1, false)).toBe("won");
    expect(landState(3, true)).toBe("won");
  });
  it("draws a field for a won stop, clutter for a held one, nothing for the next", () => {
    expect(stopLandSvg(5, "next")).toBe("");
    const won = stopLandSvg(5, "won");
    expect(won).toContain("<svg");
    expect(won).toContain("#4f7a3c"); // the hedge
    for (let id = 1; id <= 3; id++) {
      const held = stopLandSvg(id, "held");
      expect(held).toMatch(/#ff7a1a/); // Hollowell's orange in every piece of clutter
      expect(held).not.toBe(won);
    }
    // three kinds of clutter
    expect(new Set([1, 2, 3].map((id) => stopLandSvg(id, "held"))).size).toBe(3);
  });
});
