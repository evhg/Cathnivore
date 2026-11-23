import { describe, expect, it } from "vitest";
import { contrastHex, groundSvg, youPinSvg } from "../games/hedgerow/src/map";

// Plan item 663: the act map's land is painted, not hatched: every ploughed field's furrows stand under 1.3:1
// against the field they lie on, in every act, played or not.
describe("plan item 663: the act map", () => {
  it("draws furrows under 1.3:1 against their field in every act", () => {
    let seen = 0;
    for (let n = 1; n <= 10; n++)
      for (const won of [[], Array(10).fill(true)]) {
        const svg = groundSvg(n, won);
        for (const m of svg.matchAll(/stroke="(#[0-9a-f]{6})" data-on="(#[0-9a-f]{6})"/g)) {
          seen++;
          expect(contrastHex(m[1]!, m[2]!), `act ${n}`).toBeLessThan(1.3);
          expect(contrastHex(m[1]!, m[2]!), `act ${n}: still a visible texture`).toBeGreaterThan(1.08);
        }
      }
    expect(seen).toBeGreaterThan(20);
  });

  it("draws Cath's token as a pin holding her portrait", () => {
    const svg = youPinSvg("hip");
    expect(svg).toContain('class="you-pin"');
    expect(svg).toContain('data-framing="bust"');
    expect(svg).toContain('data-pose="hip"');
  });
});
